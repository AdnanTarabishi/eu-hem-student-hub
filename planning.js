// Shared presentation and date helpers for the two academic planner pages.
// Official sessions use Bologna local time; the visitor's device timezone may differ.
const Planner = (() => {
  const clock = () => NotesSchedule.clock();
  function addDays(key, days) {
    const date = new Date(`${key}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function upcomingExam(exam, now) {
    const today = now.slice(0, 10);
    return exam.dateKey > today || (exam.dateKey === today &&
      (!exam.time || `${exam.dateKey}T${exam.time.padStart(5, "0")}:00` >= now));
  }
  function registration(exam, today) {
    if (!exam.registrationOpens || !exam.registrationCloses) {
      return { key: "unknown", label: "Check AlmaEsami", days: null };
    }
    if (today < exam.registrationOpens) {
      return { key: "soon", label: "Opens later", days: daysBetween(today, exam.registrationOpens) };
    }
    if (today <= exam.registrationCloses) {
      const days = daysBetween(today, exam.registrationCloses);
      return { key: "open", label: days === 0 ? "Closes today" : "Registration open", days };
    }
    return { key: "closed", label: "Registration closed", days: null };
  }
  function summary(target, items) {
    target.replaceChildren(...items.map(({ label, value, note }) => {
      const item = createElement("div", "planning-stat");
      item.append(createElement("span", "planning-stat-label", label),
        createElement("strong", "planning-stat-value", String(value)),
        createElement("span", "planning-stat-note", note));
      return item;
    }));
  }
  function empty(target, { title, text, onReset, retry, source }) {
    const box = createElement("div", "planning-empty");
    box.append(createElement("h3", null, title), createElement("p", null, text));
    const actions = createElement("div", "item-actions");
    if (onReset) actions.appendChild(iconButton("Clear filters", "close", { onClick: onReset }));
    if (retry) actions.appendChild(iconButton("Retry", "arrow-right", { onClick: retry }));
    if (source) actions.appendChild(iconButton("Official UniBo page", "external", { href: source }));
    if (actions.childElementCount) box.appendChild(actions);
    target.replaceChildren(box);
  }
  function checked(target) {
    const now = clock();
    target.textContent = `Loaded ${formatDay(now.slice(0, 10), { day: "numeric", month: "short" })} at ${now.slice(11, 16)} · Bologna time`;
  }
  return { clock, addDays, upcomingExam, registration, summary, empty, checked };
})();
