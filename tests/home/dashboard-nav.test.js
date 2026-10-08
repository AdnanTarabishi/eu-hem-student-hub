// Homepage day/exam browsing with fictional, official-format UniBo responses.
// Run: node tests/home/dashboard-nav.test.js .
const assert = require("assert");
const fs = require("fs"), http = require("http"), path = require("path");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const { shiftDashboardDay, upcomingDashboardExams } = require(path.join(ROOT, "dashboard.js"));
let checks = 0;
const ok = (message) => { checks++; console.log(`  ok  ${message}`); };

for (const [day, offset, expected] of [
  ["2026-10-25", 1, "2026-10-26"], ["2026-03-29", -1, "2026-03-28"],
  ["2026-12-31", 1, "2027-01-01"], ["2028-02-28", 1, "2028-02-29"],
]) assert.strictEqual(shiftDashboardDay(day, offset), expected);
const sameDay = [{ id: "late", dateKey: "2026-10-10", time: "14:00" }, { id: "noon", dateKey: "2026-10-10", time: "12:00" },
  { id: "early", dateKey: "2026-10-10", time: "9:00" }, { id: "past", dateKey: "2026-10-05", time: "09:00" },
  { id: "parallel", dateKey: "2026-10-10", time: "09:00" }, { id: "untimed", dateKey: "2026-10-10", time: "" }];
assert.deepStrictEqual(upcomingDashboardExams(sameDay, "2026-10-06").map((exam) => exam.id), ["untimed", "early", "parallel", "noon", "late"]);
assert.strictEqual(sameDay[0].id, "late", "sorting must not mutate the source feed");
ok("calendar-day increments cross DST, year and leap-day boundaries; exam sorting handles single-digit hours, missing times and stable same-time sittings");

function session(code, date, start = "09:00", end = "11:00") {
  return { cod_modulo: code, title: "Fictional timetable fixture", start: `${date}T${start}:00`, end: `${date}T${end}:00`,
    time: `${start} - ${end}`, aule: [{ des_edificio: "Test classroom", des_indirizzo: "Bologna" }], docente: "Test teacher" };
}
const sessions = [session("79060", "2026-10-10"), session("C8393", "2026-10-09"), session("96500", "2026-10-08"),
  session("32626", "2026-10-06", "15:00", "17:00"), session("96498", "2026-10-06", "12:00", "14:00"),
  session("79060", "2026-10-06"), session("79060", "2026-10-05")];

// Each distinct place/time is a separate sitting under the site's shared UniBo parser.
const examFixtures = [
  { code: "70125", when: "20 October 2026 at 09:00", place: "Test room E", opens: "01 October 2026", closes: "05 October 2026" },
  { code: "96498", when: "12 October 2026 at 10:00", place: "Test room D", opens: "07 October 2026", closes: "11 October 2026" },
  { code: "96500", when: "10 October 2026 at 12:00", place: "Test room C", opens: "01 October 2026", closes: "09 October 2026" },
  { code: "79060", when: "05 October 2026 at 09:00", place: "Test past room", opens: "01 September 2026", closes: "04 October 2026" },
  { code: "96500", when: "10 October 2026 at 9:00", place: "Test room B", opens: "01 October 2026", closes: "09 October 2026" },
  { code: "32626", when: "09 October 2026 at 09:00", place: "Test room A", opens: "01 October 2026", closes: "08 October 2026" },
];
function examsPage(fixtures) {
  return fixtures.map((exam, index) => `<h3 role="tab" aria-controls="exam-${index}"><a><span class="code">${exam.code}</span>
    Fictional exam fixture <span class="docente">TEST TEACHER</span></a></h3><div id="exam-${index}"><table class="single-item">
    <tr><th>When</th><td>${exam.when}</td></tr><tr><th>Place:</th><td>${exam.place}</td></tr>
    <tr><th>Test type:</th><td>scritto</td></tr><tr><th>Subscriptions list:</th><td><span>${exam.opens}</span><span>${exam.closes}</span></td></tr>
    </table></div>`).join("");
}
const savedPlan = JSON.stringify({ version: 1, cohort: "2026-27", term: "y1-s1", choices: { quant: "96496", elective: "70125" }, statuses: {} });
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };

(async () => {
  const site = http.createServer((request, response) => {
    const file = path.resolve(ROOT, `.${decodeURIComponent(request.url.split("?")[0]) === "/" ? "/index.html" : decodeURIComponent(request.url.split("?")[0])}`);
    if (!file.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404); return response.end("Missing");
    }
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] || "text/plain" });
    response.end(fs.readFileSync(file));
  }).listen(0, "127.0.0.1");
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const errors = [];
  const open = async ({ day = "2026-10-06", mine = false, timetable = sessions, exams = examFixtures,
    unavailable = false, mobile = false, scheme = "light", programmeUnavailable = false } = {}) => {
    const context = await browser.newContext({ serviceWorkers: "block", reducedMotion: "reduce", timezoneId: "Europe/Rome",
      colorScheme: scheme, viewport: mobile ? { width: 375, height: 800 } : { width: 1280, height: 900 } });
    await context.clock.setFixedTime(new Date(`${day}T10:00:00+02:00`));
    if (mine) await context.addInitScript((plan) => localStorage.setItem("euhem-study-plan-v1", plan), savedPlan);
    await context.route(/unibo\.it/, (route) => {
      if (unavailable) return route.abort();
      if (route.request().url().includes("@@orario_reale_json")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(timetable) });
      if (route.request().url().endsWith("/exam-dates")) return route.fulfill({ contentType: "text/html", body: examsPage(exams) });
      return route.abort();
    });
    if (programmeUnavailable) await context.route("**/content/programme.json", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${site.address().port}/index.html`);
    await page.waitForFunction(() => !document.querySelector("#dash-today .skeleton-group") && !document.querySelector("#dash-exam .skeleton-group"));
    return page;
  };
  const selectedDate = (page) => page.getAttribute("#dash-today .dash-browse-date", "datetime");
  const dayNext = (page) => page.getByRole("button", { name: "Next day", exact: true });
  const dayPrevious = (page) => page.getByRole("button", { name: "Previous day", exact: true });
  const examNext = (page) => page.getByRole("button", { name: "Next exam", exact: true });
  const examPrevious = (page) => page.getByRole("button", { name: "Previous exam", exact: true });
  try {
    let page = await open();
    assert.strictEqual(await selectedDate(page), "2026-10-06");
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 3);
    assert.match(await page.textContent("#dash-today .dash-browse-date"), /Today.*6 October 2026/);
    assert.ok(await page.isHidden("#dash-today .dash-back-today"));
    await page.evaluate(() => { window.savedDayArrow = document.querySelector("#dash-day-nav .dash-browse-next"); });
    await dayNext(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await selectedDate(page), "2026-10-07");
    assert.match(await page.textContent("#dash-today"), /No classes scheduled for this day/);
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 0);
    assert.strictEqual(await page.evaluate(() => document.activeElement === window.savedDayArrow && document.querySelector("#dash-day-nav .dash-browse-next") === window.savedDayArrow), true);
    assert.match(await page.textContent("#dash-day-nav [role=status]"), /7 October 2026.*No classes scheduled/);
    await dayNext(page).click();
    assert.strictEqual(await selectedDate(page), "2026-10-08");
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 1);
    await page.getByRole("button", { name: "Return to today" }).click();
    assert.strictEqual(await selectedDate(page), "2026-10-06");
    assert.ok(await page.isHidden("#dash-today .dash-back-today"));
    await dayPrevious(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await selectedDate(page), "2026-10-05");
    assert.ok(await dayPrevious(page).isDisabled());
    assert.ok(await dayNext(page).evaluate((button) => button === document.activeElement), "first day keeps keyboard focus on the enabled next arrow");
    for (let i = 0; i < 4; i++) await dayNext(page).click();
    await dayNext(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await selectedDate(page), "2026-10-10");
    assert.ok(await dayNext(page).isDisabled());
    assert.ok(await dayPrevious(page).evaluate((button) => button === document.activeElement), "last day keeps keyboard focus on the enabled previous arrow");
    assert.strictEqual(await page.getAttribute('.eh-widget-today .eh-widget-footer', "href"), "timetable.html");
    ok("day arrows visit adjacent calendar days (including no-class days), keep focus, announce date and stop at known bounds; Return to today and timetable link work");

    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 1 of 5");
    assert.match(await page.textContent("#dash-exam .dash-exam-title"), /Econometrics/);
    assert.ok(await examPrevious(page).isDisabled());
    assert.strictEqual(await page.textContent("#dash-exam .dash-countdown-number"), "3");
    assert.match(await page.textContent("#dash-exam .reg-chip"), /Registration open until 8 Oct 2026/);
    await page.evaluate(() => { window.savedExamArrow = document.querySelector("#dash-exam-nav .dash-browse-next"); window.savedPeriod = document.querySelector("#dash-exam .dash-period"); });
    await examNext(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 2 of 5");
    assert.match(await page.textContent("#dash-exam .schedule-meta"), /10 Oct, 9:00/);
    assert.strictEqual(await page.textContent("#dash-exam .dash-countdown-number"), "4");
    assert.strictEqual(await page.evaluate(() => document.activeElement === window.savedExamArrow && document.querySelector("#dash-exam .dash-period") === window.savedPeriod), true);
    assert.match(await page.textContent("#dash-exam-nav [role=status]"), /Exam 2 of 5.*10 October 2026 at 9:00/);
    await examNext(page).click();
    assert.match(await page.textContent("#dash-exam .schedule-meta"), /10 Oct, 12:00/);
    await examNext(page).click();
    assert.match(await page.textContent("#dash-exam .reg-chip"), /Registration opens 7 Oct 2026/);
    await examNext(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 5 of 5");
    assert.match(await page.textContent("#dash-exam .reg-chip"), /Registration closed/);
    assert.ok(await examNext(page).isDisabled());
    assert.ok(await examPrevious(page).evaluate((button) => button === document.activeElement), "last exam keeps keyboard focus on the enabled previous arrow");
    await examPrevious(page).click();
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 4 of 5");
    for (let i = 0; i < 2; i++) await examPrevious(page).click();
    await examPrevious(page).focus();
    await page.keyboard.press("Enter");
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 1 of 5");
    assert.ok(await examPrevious(page).isDisabled());
    assert.ok(await examNext(page).evaluate((button) => button === document.activeElement), "first exam keeps keyboard focus on the enabled next arrow");
    assert.strictEqual(await page.getAttribute("#dash-exam .dash-period", "href"), "calendar.html#key-dates");
    assert.match(await page.textContent("#dash-exam .dash-period"), /Next exam period: 26 Oct – 7 Nov 2026/);
    assert.strictEqual(await page.getAttribute('#dash-exam-title', "id"), "dash-exam-title");
    assert.strictEqual(await page.locator('.eh-widget-footer[href="exams.html"]').count(), 1);
    await page.context().close();
    ok("exam arrows follow date/time order, retain same-day sittings, stop at each end, keep keyboard focus and exam-period/footer links, and update countdown/registration");

    page = await open({ mine: true, mobile: true, scheme: "dark" });
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 2);
    assert.ok(!(await page.textContent("#dash-today")).includes("Econometrics"));
    assert.match(await page.textContent("#dash-today-title"), /my courses/);
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 1 of 4");
    assert.ok(!(await page.textContent("#dash-exam")).includes("Econometrics"));
    assert.match(await page.textContent("#dash-exam-title"), /my courses/);
    for (let i = 0; i < 3; i++) await dayNext(page).click();
    assert.strictEqual(await selectedDate(page), "2026-10-09");
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 0, "unselected elective is not exposed while browsing");
    await examNext(page).click();
    await examNext(page).click();
    assert.match(await page.textContent("#dash-exam .dash-exam-title"), /Statistics/);
    assert.match(await page.textContent("#dash-exam-title"), /my courses/);
    for (const selector of ["#dash-day-nav button", "#dash-exam-nav button"]) {
      const sizes = await page.$$eval(selector, (buttons) => buttons.map((button) => { const box = button.getBoundingClientRect(); return [box.width, box.height]; }));
      assert.ok(sizes.every(([width, height]) => width >= 44 && height >= 44), "mobile arrows have 44px targets");
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.context().close();
    ok("all browsing reuses the saved study-plan filter; personal labels survive title updates and mobile controls remain accessible");

    page = await open({ day: "2026-10-07" });
    assert.strictEqual(await selectedDate(page), "2026-10-08", "initial next-class fallback displays its real date");
    assert.match(await page.textContent("#dash-today"), /No classes today/);
    await dayPrevious(page).click();
    assert.strictEqual(await selectedDate(page), "2026-10-07", "previous day starts from the actually displayed date");
    assert.match(await page.textContent("#dash-today"), /No classes scheduled for this day/);
    assert.ok(await page.isHidden("#dash-today .dash-back-today"));
    await page.context().close();
    page = await open({ day: "2026-10-11" });
    assert.match(await page.textContent("#dash-today"), /No more classes this semester/);
    assert.ok(await dayPrevious(page).isEnabled(), "past official sessions remain browseable after the last class");
    await dayPrevious(page).click();
    assert.strictEqual(await selectedDate(page), "2026-10-10");
    assert.strictEqual(await page.locator("#dash-today .dash-class").count(), 1);
    await page.context().close();
    ok("initial next-day and end-of-semester empty states still allow browsing from the explicit displayed date");

    page = await open({ timetable: [], exams: [] });
    for (const button of [dayPrevious(page), dayNext(page), examPrevious(page), examNext(page)]) assert.ok(await button.isDisabled());
    assert.match(await page.textContent("#dash-exam"), /No upcoming exam dates published/);
    assert.strictEqual(await page.locator("#dash-exam .dash-period").count(), 1);
    await page.context().close();
    page = await open({ exams: [examFixtures[0]] });
    assert.strictEqual(await page.textContent("#dash-exam .dash-browse-position"), "Exam 1 of 1");
    assert.ok(await examPrevious(page).isDisabled());
    assert.ok(await examNext(page).isDisabled());
    await page.context().close();
    page = await open({ unavailable: true });
    assert.match(await page.textContent("#dash-today"), /timetable couldn't be loaded from UniBo/);
    assert.match(await page.textContent("#dash-exam"), /Exam dates couldn't be loaded from UniBo/);
    assert.match(await page.textContent("#dash-exam .dash-period"), /Next exam period/);
    for (const button of [dayPrevious(page), dayNext(page), examPrevious(page), examNext(page)]) assert.ok(await button.isDisabled());
    await page.context().close();
    page = await open({ programmeUnavailable: true });
    assert.match(await page.textContent("#dash-today"), /couldn't be loaded right now/);
    for (const button of [dayPrevious(page), dayNext(page), examPrevious(page), examNext(page)]) assert.ok(await button.isDisabled());
    await page.context().close();
    ok("zero/single exam and unavailable official feeds disable browsing without inventing data; programme exam-period links survive a UniBo failure");
    assert.deepStrictEqual(errors, [], "no browser JavaScript errors");
    ok("no JavaScript errors across fixtures, personal plans, mobile and source failures");
  } finally {
    await browser.close();
    site.close();
  }
  console.log(`${checks} dashboard browsing checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
