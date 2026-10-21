// ===== UniBo data: timetable feed and exam dates =====
// Loads the official UniBo timetable and exam pages (their addresses are in
// content/programme.json, under "sources"), and matches classes and exams to our
// courses and modules by their official codes.
// Shared by the home page (timetable, exams) and the course pages (Schedule, Exam tabs).

const EXAM_MONTHS = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};
const EXAM_TYPES = { scritto: "Written", orale: "Oral", pratico: "Practical" };

// Loaded once per page, even if several parts ask for it
let programmePromise = null;
function getProgramme() {
  programmePromise = programmePromise || loadProgramme();
  return programmePromise;
}

// ----- Timetable -----

// Keep the complete classroom payload published by UniBo. Older code retained
// only building + address, hiding the aula name and floor.
function timetableClassroomRecord(room = {}) {
  const clean = value => String(value || "").replace(/\s+/g, " ").trim();
  return {
    name: clean(room.des_risorsa || room.raw?.descrizione),
    floor: clean(room.des_piano),
    building: clean(room.des_edificio),
    address: clean(room.des_indirizzo),
  };
}
function timetableClassroomText(room = {}) {
  return [...new Set([room.name, room.floor, room.building, room.address].filter(Boolean))].join(" · ");
}
function timetableClassroomsText(classrooms = []) {
  return classrooms.map(timetableClassroomText).filter(Boolean).join(" + ");
}

// Both official sources use bounded requests and the same transient-error policy.
async function requestOfficialPage(url, label, read, options = {}) {
  const attempts = options.attempts || 3;
  const delayMs = options.delayMs === undefined ? 500 : options.delayMs;
  const timeoutMs = options.timeoutMs || 15000;
  const fetcher = options.fetcher || fetch;
  const pause = options.pause || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const request = { cache: "no-store" };
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        request.signal = AbortSignal.timeout(timeoutMs);
        if(options.signal&&typeof AbortSignal.any==="function")request.signal=AbortSignal.any([request.signal,options.signal]);
      }
      const response = await fetcher(url, request);
      if (!response.ok) {
        const error = new Error(`${label}: HTTP ${response.status}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      return await read(response);
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted || error.retryable === false || attempt === attempts - 1) break;
      await pause(Math.min(delayMs * (2 ** attempt), 10000));
    }
  }
  throw lastError;
}

function oldestSavedAt(values) {
  return values.filter(value=>value && Number.isFinite(Date.parse(value))).sort((a,b)=>Date.parse(a)-Date.parse(b))[0] || "";
}

// UniBo's timetable endpoint now needs a bounded date range. Longer ranges are
// requested in <=31-day pieces; an incomplete set must never look like a full refresh.
function timetableRequestUrls(url) {
  const source=new URL(url),start=source.searchParams.get("start"),end=source.searchParams.get("end");
  if(!start&&!end)return [source.href];
  const valid=date=>/^\d{4}-\d{2}-\d{2}$/.test(date||"") && Number.isFinite(Date.parse(date)) && new Date(date+"T00:00:00Z").toISOString().slice(0,10)===date;
  if(!valid(start)||!valid(end)||start>end||Date.parse(end)-Date.parse(start)>732*86400000)throw new Error("Timetable: invalid source date range");
  const result=[];
  for(let at=Date.parse(start+"T00:00:00Z"),last=Date.parse(end+"T00:00:00Z");at<=last;at+=31*86400000){
    const next=new URL(source);
    next.searchParams.set("start",new Date(at).toISOString().slice(0,10));
    next.searchParams.set("end",new Date(Math.min(last,at+30*86400000)).toISOString().slice(0,10));
    next.searchParams.set("calendar_view","");result.push(next.href);
  }
  return result;
}

async function requestOfficialTimetable(url, options = {}) {
  const sourceUrls=timetableRequestUrls(url),rows=[],dates=[];
  for(const source of sourceUrls){
    const part=await requestOfficialPage(source,"Timetable",async response=>{
      const raw=await response.json();
      if(!Array.isArray(raw)||raw.some(s=>!s||typeof s.start!=="string"||typeof s.end!=="string"||!s.cod_modulo))throw new Error("Timetable: invalid official response");
      return {raw,cachedAt:response.headers?.get("x-saved-at")||""};
    },options);
    rows.push(...part.raw);dates.push(part.cachedAt);
  }
  const raw=[...new Map(rows.map(s=>[[s.extCode||s.cod_modulo,s.start,s.end].join("|"),s])).values()];
  return {raw,cachedAt:oldestSavedAt(dates),sourceUrls};
}

function publicSourceMeta(cachedAt="", extra={}) {
  return {cachedAt,verifiedAt:cachedAt||new Date().toISOString(),sourceType:cachedAt?"cached":"live",...extra};
}

// Same-origin snapshots contain only public university records. Their verification
// time is preserved; successfully downloading an old copy is not a live source check.
async function publishedAcademicCopy(kind, source, options={}) {
  const response=await (options.fetcher||fetch)(`calendar/${kind}.json`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error("Saved academic copy unavailable");
  const snapshot=await response.json();
  if(snapshot?.version!==1||snapshot.source!==String(source)||!Array.isArray(snapshot.records)||snapshot.records.length>5000||
      !(snapshot.verifiedAt&&Number.isFinite(Date.parse(snapshot.verifiedAt)))&&snapshot.sourceType!=="calendar-copy")throw new Error("Invalid saved academic copy");
  if(kind==="timetable"&&(!snapshot.records.length||snapshot.records.some(s=>!s.moduleCode||!/^\d{4}-\d{2}-\d{2}T/.test(s.start||"")||!s.end)))throw new Error("Invalid saved timetable");
  if(kind==="exams"&&snapshot.records.some(e=>!Array.isArray(e.codes)||!/^\d{4}-\d{2}-\d{2}$/.test(e.dateKey||"")))throw new Error("Invalid saved exams");
  const records=snapshot.records;
  Object.defineProperty(records,"sourceMeta",{value:{cachedAt:snapshot.verifiedAt||"",verifiedAt:snapshot.verifiedAt||null,sourceType:snapshot.sourceType==="calendar-copy"?"calendar-copy":"published-copy"},enumerable:false});
  return records;
}

// Every class in the feed includes the complete official classroom description.
async function fetchTimetable(url, options = {}) {
  let source;
  const controller=typeof document!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),9000):null;
  try{source=await requestOfficialTimetable(url, {...options,...(controller?{signal:controller.signal}:{})});}
  catch(error){
    if(typeof document==="undefined"||options.fallback===false)throw error;
    try{return await publishedAcademicCopy("timetable",url,options);}catch{throw error;}
  }finally{if(timer)clearTimeout(timer);}
  const {raw,cachedAt}=source;
  const sessions = raw
    .map((s) => {
      const classrooms = (s.aule || []).map(timetableClassroomRecord);
      return {
        moduleCode: s.cod_modulo,
        feedTitle: s.title,
        dateKey: s.start.slice(0, 10),
        start: s.start,
        end: s.end,
        time: s.time,
        classrooms,
        room: timetableClassroomsText(classrooms),
        teacher: s.docente,
        online: s.teledidattica,
        note: s.note,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  Object.defineProperty(sessions, "sourceMeta", { value: publicSourceMeta(cachedAt), enumerable: false });
  return sessions;
}

// ----- Exam dates -----

// "05 November 2026 at 09:00" -> { dateKey: "2026-11-05", time: "09:00" }
function parseUniboDate(text) {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:\s+at\s+(\d{1,2}:\d{2}))?/i);
  if (!match) return null;
  const [, day, monthName, year, time] = match;
  const month = EXAM_MONTHS[monthName.toLowerCase()];
  if (!month) return null;
  return { dateKey: `${year}-${month}-${day.padStart(2, "0")}`, time: time ? time.padStart(5, "0") : "" };
}

function examText(value) {
  return String(value || "").normalize("NFC").replace(/\s+/g, " ").trim();
}

// Punctuation and spacing are presentational; numbers and words remain distinct.
function normalizedExamText(value) {
  return examText(value).toLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
}

// These fields are optional: an absent duration is never replaced with an estimate.
// Both the browser and calendar reader use the same source-field interpretation.
function examPublishedDetails(fields) {
  const values = new Map(Object.entries(fields).map(([label, value]) =>
    [normalizedExamText(label), examText(value)]));
  const read = labels => labels.map(label => values.get(label)).find(Boolean) || "";
  const when = read(["when"]);
  const end = read(["end time", "ends at", "orario fine"]) ||
    (when.match(/\bat\s+\d{1,2}:\d{2}\s*(?:[-–—]|until|to)\s*(\d{1,2}:\d{2})/i) || [])[1] || "";
  const clock = end.match(/^(?:at\s+)?(\d{1,2}):([0-5]\d)$/i);
  return {
    duration: read(["duration", "exam duration", "test duration", "durata"]),
    notes: read(["notes", "note", "remarks", "additional information", "avvertenze"]),
    endTime: clock && Number(clock[1]) <= 23 ? `${clock[1].padStart(2, "0")}:${clock[2]}` : "",
  };
}

// Reads the exam dates page. Each exam: { codes, names, dateKey, time, teachers, type, place, registration... }
// The page is made for people, not programs: if UniBo redesigns it, this needs updating.
function parseExamsPage(html) {
  const page = new DOMParser().parseFromString(html, "text/html");
  const exams = [];
  for (const heading of page.querySelectorAll('h3[role="tab"]')) {
    const link = heading.querySelector("a");
    if (!link) continue;
    const codeElement = link.querySelector(".code");
    const teacherElement = link.querySelector(".docente");
    let name = link.textContent;
    if (codeElement) name = name.replace(codeElement.textContent, "");
    if (teacherElement) name = name.replace(teacherElement.textContent, "");
    const courseCode = codeElement ? examText(codeElement.textContent).toUpperCase() : "";
    const teacher = teacherElement ? toTitleCase(teacherElement.textContent) : "";

    const panel = page.getElementById(heading.getAttribute("aria-controls"));
    if (!panel) continue;
    for (const table of panel.querySelectorAll("table.single-item")) {
      const fields = {};
      for (const row of table.querySelectorAll("tr")) {
        const label = row.querySelector("th")?.textContent.trim();
        const cell = row.querySelector("td");
        if (label && cell) fields[label] = cell;
      }
      const when = parseUniboDate(fields["When"]?.textContent || "");
      if (!when) continue;
      const spans = fields["Subscriptions list:"]?.querySelectorAll("span") || [];
      const opens = spans[0] ? parseUniboDate(spans[0].textContent) : null;
      const closes = spans[1] ? parseUniboDate(spans[1].textContent) : null;
      // Integrated courses: "Componente: 32626 - ECONOMETRICS" says which module the exam is for
      const component = fields["Componente:"]?.textContent.replace(/\s+/g, " ").trim() || "";
      const componentCode = (component.match(/^([A-Z0-9]+)\s*-/) || [])[1] || "";
      const typeText = fields["Test type:"]?.textContent.trim() || "";
      const details = examPublishedDetails(Object.fromEntries(Object.entries(fields)
        .map(([label, cell]) => [label, cell.textContent])));

      exams.push({
        codes: [courseCode, componentCode].filter(Boolean),
        names: [toTitleCase(name.replace(/\s+/g, " ")), componentCode &&
          toTitleCase(component.replace(/^[A-Z0-9]+\s*-\s*/, ""))].filter(Boolean),
        dateKey: when.dateKey,
        time: when.time,
        teachers: teacher ? [teacher] : [],
        type: EXAM_TYPES[typeText.toLowerCase()] || typeText,
        place: fields["Place:"]?.textContent.trim() || "",
        registrationOpens: opens?.dateKey || "",
        registrationCloses: closes?.dateKey || "",
        ...details,
      });
    }
  }
  return mergeExamSittings(exams);
}

// UniBo may list the same assessment under its integrated course and its module.
// Only an explicit parent/component relationship identifies those aliases. A
// parent-only row stays separate if two compatible components are possible.
// Booking, format, room or published-detail conflicts also remain separate.
function mergeExamSittings(exams) {
  const fields = ["place", "type", "registrationOpens", "registrationCloses", "duration", "endTime", "notes"];
  const compatible = (a, b) => fields.every(field => !a[field] || !b[field] ||
    normalizedExamText(a[field]) === normalizedExamText(b[field]));
  const rows = exams.map(exam => {
    const row = { ...exam };
    for (const list of ["codes", "names", "teachers", "moduleCodes", "courseIds"]) {
      if (!Array.isArray(exam[list]) && !["codes", "names", "teachers"].includes(list)) continue;
      row[list] = [...new Map((exam[list] || []).filter(Boolean).map(value =>
        [normalizedExamText(value), examText(value)])).values()];
    }
    row.codes = row.codes.map(code => code.toUpperCase());
    for (const field of fields) row[field] = examText(exam[field]);
    row.time = examText(exam.time).replace(/^(\d):/, "0$1:");
    row.assessmentCode = examText(exam.assessmentCode || row.moduleCodes?.at(-1) || row.codes.at(-1)).toUpperCase();
    return row;
  });
  const slots = new Map();
  for (const row of rows) {
    const key = `${row.dateKey}|${row.time}`;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key).push(row);
  }
  const result = [];
  for (const slot of slots.values()) {
    for (const row of slot) {
      if (row.codes.length !== 1 || !row.assessmentCode) continue;
      const components = new Set(slot.filter(other => other.codes.length > 1 &&
        other.codes.slice(0, -1).includes(row.assessmentCode) && compatible(row, other))
        .map(other => other.assessmentCode));
      if (components.size === 1) row.assessmentCode = [...components][0];
    }
    // Inspect the full slot first: a partial row must not be assigned to one of
    // two conflicting possibilities just because that possibility appears first.
    const ambiguous = new Set(slot.filter(row => {
      const matches = slot.filter(other => other.assessmentCode === row.assessmentCode && compatible(row, other));
      return matches.some((a, index) => matches.slice(index + 1).some(b => !compatible(a, b)));
    }));
    // Prefer the richer source text when non-conflicting records are combined.
    const ordered = [...slot].sort((a, b) => fields.filter(field => b[field]).length -
      fields.filter(field => a[field]).length);
    const merged = [];
    for (const row of ordered) {
      let candidates = row.assessmentCode ? merged.filter(other =>
        other.assessmentCode === row.assessmentCode && compatible(row, other)) : [];
      // Even an ambiguous incomplete record can have an exact duplicate of its
      // own; remove that repeat without assigning it to either richer sitting.
      const exact = candidates.filter(other => fields.every(field =>
        normalizedExamText(row[field]) === normalizedExamText(other[field])));
      if (exact.length === 1) candidates = exact;
      else candidates = candidates.filter(other => !ambiguous.has(row) && !ambiguous.has(other));
      if (candidates.length !== 1) {
        merged.push(row);
        continue;
      }
      const existing = candidates[0];
      for (const list of ["codes", "names", "teachers", "moduleCodes", "courseIds"]) {
        if (!row[list]) continue;
        if (!existing[list]) existing[list] = [];
        const values = new Set(existing[list].map(normalizedExamText));
        for (const value of row[list]) if (!values.has(normalizedExamText(value))) {
          existing[list].push(value);
          values.add(normalizedExamText(value));
        }
      }
      for (const field of fields) if (!existing[field] && row[field]) existing[field] = row[field];
      if (existing.codes.includes(existing.assessmentCode)) {
        existing.codes = existing.codes.filter(code => code !== existing.assessmentCode).concat(existing.assessmentCode);
      }
    }
    result.push(...merged);
  }
  return result.sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));
}

function nextExamPage(html, current, origin) {
  let next="";
  const parent=html.match(/<(?:li|span)\b[^>]*class=["'][^"']*\bnext\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:li|span)>/i);
  for(const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    if(/\brel=["'][^"']*\bnext\b/i.test(match[1])||/\bclass=["'][^"']*\bnext\b/i.test(match[1])||/^\s*(?:Next|Successiv)/i.test(match[2].replace(/<[^>]*>/g,""))){next=(match[1].match(/\bhref=["']([^"']+)["']/i)||[])[1]||"";break;}
  }
  if(!next&&parent)next=(parent[1].match(/\bhref=["']([^"']+)["']/i)||[])[1]||"";
  if(!next)return "";
  const target=new URL(next.replace(/&amp;|&#38;/gi,"&"),current);
  if(target.origin!==origin||target.pathname!==new URL(current).pathname||target.username||target.password)throw new Error("Exams: unsafe pagination source link");
  target.hash="";return target.href;
}

async function requestOfficialExams(url,options={}) {
  const origin=new URL(url).origin,pages=[],sourceUrls=[],dates=[],seen=new Set();let next=new URL(url).href;
  while(next){
    if(seen.has(next))throw new Error("Exams: pagination loop");
    if(pages.length>=20)throw new Error("Exams: pagination page limit exceeded");
    seen.add(next);
    const part=await requestOfficialPage(next,"Exams",async response=>{
      const html=await response.text();
      if(!/<h3\b[^>]*role=["']tab["']/i.test(html)&&!/no (?:upcoming |scheduled )?exam(?: dates)?s?\b|nessun appello|non sono presenti appelli/i.test(html))throw new Error("Exams: unrecognised official response page");
      const tables=[...html.matchAll(/<table\b[^>]*class=["'][^"']*\bsingle-item\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi)];
      for(const [,table] of tables){
        const when=[...table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi)].find(row=>row[1].replace(/<[^>]*>/g,"").trim().toLowerCase()==="when");
        if(!when||!parseUniboDate(when[2].replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ")))throw new Error("Exams: unrecognised date in a published sitting");
      }
      return {html,cachedAt:response.headers?.get("x-saved-at")||""};
    },options);
    pages.push(part.html);sourceUrls.push(next);dates.push(part.cachedAt);
    next=nextExamPage(part.html,next,origin);
  }
  return {pages,sourceUrls,cachedAt:oldestSavedAt(dates)};
}

async function fetchExams(url,options={}) {
  const controller=typeof document!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),9000):null;
  try{
    const {pages,cachedAt}=await requestOfficialExams(url,{...options,...(controller?{signal:controller.signal}:{})});
    const exams=mergeExamSittings(pages.flatMap(parseExamsPage));
    Object.defineProperty(exams,"sourceMeta",{value:publicSourceMeta(cachedAt),enumerable:false});
    return exams;
  }catch(error){
    if(typeof document==="undefined"||options.fallback===false)throw error;
    try{return await publishedAcademicCopy("exams",url,options);}catch{throw error;}
  }finally{if(timer)clearTimeout(timer);}
}

// ----- Matching to our courses (by official code) -----

// Keeps exams of this term's courses and names them from programme.json:
// exam.courseIds, exam.title ("Econometrics"), exam.partOf ("Quantitative Methods ... (I.C.)")
function matchExamsToTerm(exams, term) {
  const result = [];
  for (const exam of exams) {
    const modules = [];
    const courses = [];
    for (const course of term.courses) {
      const matchedModules = course.modules.filter((m) => exam.codes.includes(m.code));
      if (matchedModules.length || exam.codes.includes(course.code)) {
        courses.push(course);
        modules.push(...matchedModules);
      }
    }
    if (courses.length === 0) continue;
    const course = courses[0];
    const moduleNames = [...new Set(modules.map((m) => m.name))];
    result.push({
      ...exam,
      courseIds: courses.map((c) => c.id),
      moduleCodes: modules.map((m) => m.code),
      title: course.integrated && moduleNames.length ? moduleNames.join(" / ") : course.name,
      partOf: course.integrated ? `${course.name} (I.C.)` : "",
    });
  }
  return result.sort((a, b) => (a.dateKey + a.time).localeCompare(b.dateKey + b.time));
}

// Module name for a class, from programme.json (falls back to the feed's title)
function sessionLabel(session, index) {
  const found = index.modulesByCode[session.moduleCode];
  return found ? found.module.name : toTitleCase(session.feedTitle.split("/").pop());
}

// ----- Shared pieces of page -----

// "in 35 days", "Tomorrow", "Today"
function countdownText(dateKey, today) {
  const days = daysBetween(today, dateKey);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `in ${days} days`;
}

function registrationText(exam, today) {
  const shortDate = { day: "numeric", month: "short", year: "numeric" };
  if (!exam.registrationOpens || !exam.registrationCloses) return null;
  if (today < exam.registrationOpens) return { text: `Registration opens ${formatDay(exam.registrationOpens, shortDate)}`, open: false };
  if (today <= exam.registrationCloses) return { text: `Registration open until ${formatDay(exam.registrationCloses, shortDate)}`, open: true };
  return { text: "Registration closed", open: false };
}

// One exam sitting as a card (home page and course page)
function examItem(exam, today) {
  const item = createElement("div", "exam-item");
  const when = createElement("div", "exam-when");
  when.appendChild(createElement("span", "exam-date", formatDay(exam.dateKey, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  }) + (exam.time ? `, ${exam.time}` : "")));
  if (exam.dateKey >= today) when.appendChild(createElement("span", "badge", countdownText(exam.dateKey, today)));
  item.appendChild(when);
  item.appendChild(createElement("div", "exam-course", exam.title));
  if (exam.partOf) item.appendChild(createElement("div", "schedule-meta", `Part of ${exam.partOf}`));
  const details = [exam.type, exam.place, exam.teachers.join(", ")].filter(Boolean);
  item.appendChild(createElement("div", "schedule-meta", details.join(" · ")));
  const registration = registrationText(exam, today);
  if (registration) item.appendChild(createElement("div", registration.open ? "exam-registration is-open" : "exam-registration", registration.text));
  if (typeof downloadEvent === "function") item.appendChild(examActions(exam));
  return item;
}

// Classes grouped by day (home page and course page)
function scheduleDays(sessions, index, today) {
  const box = createElement("div");
  const byDay = {};
  for (const session of sessions) (byDay[session.dateKey] = byDay[session.dateKey] || []).push(session);
  for (const dateKey of Object.keys(byDay).sort()) {
    const day = createElement("div", dateKey === today ? "schedule-day is-today" : "schedule-day");
    day.appendChild(createElement("h3", null, dateKey === today ? `Today, ${formatDay(dateKey)}` : formatDay(dateKey)));
    for (const session of byDay[dateKey]) {
      const item = createElement("div", "schedule-item");
      item.appendChild(createElement("div", "schedule-time", session.time));
      const details = createElement("div", "schedule-details");
      details.appendChild(createElement("div", "schedule-course", sessionLabel(session, index)));
      if (session.online) details.appendChild(createElement("span", "badge", "Online"));
      if (session.room) details.appendChild(createElement("div", "schedule-meta", session.room));
      if (session.teacher) details.appendChild(createElement("div", "schedule-meta", session.teacher));
      if (session.note) details.appendChild(createElement("div", "schedule-meta", session.note));
      if (typeof downloadEvent === "function") details.appendChild(sessionActions(session, index));
      item.appendChild(details);
      day.appendChild(item);
    }
    box.appendChild(day);
  }
  return box;
}

// ----- Actions: map and "add to my calendar" (need ui.js) -----

function sessionActions(session, index) {
  const row = createElement("div", "item-actions");
  if (session.room) row.appendChild(iconButton("Map", "map-pin", { href: mapUrl(session.room), ariaLabel: `Map: ${session.room}` }));
  row.appendChild(iconButton("Add to calendar", "plus", {
    ariaLabel: `Add to calendar: ${sessionLabel(session, index)}, ${session.dateKey}`, // starts with the visible words
    onClick: () => downloadEvent({
      uid: `class-${session.moduleCode}-${session.start}`,
      title: sessionLabel(session, index),
      start: session.start,
      end: session.end,
      location: session.room,
      description: [session.teacher, session.note].filter(Boolean).join("\n"),
    }),
  }));
  return row;
}

// "2026-11-05T09:00:00" + 2 hours (exam end times aren't published)
function plusHours(isoLocal, hours) {
  const date = new Date(isoLocal + "Z");
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString().slice(0, 19);
}

// Shared by single-event exports and generated subscriptions. Identity includes
// the assessment and any conflicting published details, not just its room/time.
function examSittingIdentity(exam) {
  const assessment = exam.assessmentCode || exam.moduleCodes?.at(-1) || exam.codes?.at(-1) ||
    exam.courseIds?.join("+") || exam.title || exam.names?.join("+") || "unknown";
  return [assessment, exam.dateKey, exam.time, exam.place, exam.type,
    exam.registrationOpens, exam.registrationCloses, exam.duration, exam.endTime, exam.notes]
    // Encode fields separately so empty values and room/type boundaries stay distinct.
    .map(value => encodeURIComponent(normalizedExamText(value))).join("--");
}

function examCalendarTimes(exam, estimatedHours = 2) {
  const start = `${exam.dateKey}T${exam.time || "09:00"}:00`;
  const validClock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
  const publishedEnd = validClock(exam.time) && validClock(exam.endTime) && exam.endTime > exam.time;
  return { start, end: publishedEnd ? `${exam.dateKey}T${exam.endTime}:00` : plusHours(start, estimatedHours),
    estimated: !publishedEnd };
}

function examActions(exam, today = todayKey()) {
  const row = createElement("div", "item-actions");
  if (exam.place) row.appendChild(iconButton("Map", "map-pin", { href: mapUrl(`${exam.place}, Bologna`), ariaLabel: `Map: ${exam.place}` }));
  const timing = examCalendarTimes(exam);
  row.appendChild(iconButton("Add exam", "plus", {
    ariaLabel: `Add exam: ${exam.title}`,
    onClick: () => downloadEvent({
      uid: `exam-${examSittingIdentity(exam)}`,
      title: `Exam: ${exam.title}`,
      start: timing.start,
      end: timing.end,
      location: exam.place,
      description: [exam.type && `Type: ${exam.type}`, exam.teachers.join(", "),
        exam.duration && `Published duration: ${exam.duration}`, exam.notes && `Notes: ${exam.notes}`,
        !exam.time && "Start time is a placeholder (09:00); confirm the time on UniBo.",
        timing.estimated ? "End time is an estimate. Register on AlmaEsami." :
          "End time is published by UniBo. Register on AlmaEsami."].filter(Boolean).join("\n"),
    }),
  }));
  if (exam.registrationCloses && exam.registrationCloses >= today) {
    row.appendChild(iconButton("Registration reminder", "bell", {
      ariaLabel: `Registration reminder: last day to register for ${exam.title}`,
      onClick: () => {
        const next = new Date(exam.registrationCloses + "T12:00:00");
        next.setDate(next.getDate() + 1);
        downloadEvent({
          uid: `registration-${examSittingIdentity(exam)}`,
          title: `Last day to register: ${exam.title}`,
          start: exam.registrationCloses,
          end: dateToKey(next),
          description: `Exam on ${exam.dateKey}. Register on AlmaEsami.`,
        });
      },
    }));
  }
  return row;
}

// ----- Now / next class, week layout (pure, tested) -----

// Local time as "YYYY-MM-DDTHH:MM:SS", the same format as the timetable feed
function localIso(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${dateToKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// { now: the class happening now (or null), next: the next class to start (or null) }
function nowAndNext(sessions, nowIso) {
  let now = null;
  let next = null;
  for (const session of sessions) {
    if (session.start <= nowIso && nowIso < session.end && !now) now = session;
    if (session.start > nowIso && (!next || session.start < next.start)) next = session;
  }
  return { now, next };
}

// The Monday of the week containing dateKey
function weekStartOf(dateKey) {
  const date = new Date(dateKey + "T12:00:00");
  const offset = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - offset);
  return dateToKey(date);
}

// "11:30" -> 11.5
function hourOf(isoLocal) {
  return Number(isoLocal.slice(11, 13)) + Number(isoLocal.slice(14, 16)) / 60;
}

// Places one day's classes in side-by-side lanes when they overlap.
// Returns [{ session, lane, lanes }] - lane = column within the overlap group, lanes = columns in that group.
function layoutDay(sessions) {
  const sorted = [...sessions].sort((a, b) => a.start.localeCompare(b.start));
  const placed = [];
  let group = [];
  let groupEnd = "";
  const closeGroup = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) g.lanes = lanes;
    group = [];
  };
  for (const session of sorted) {
    if (group.length && session.start >= groupEnd) closeGroup();
    const busy = group.filter((g) => g.session.end > session.start).map((g) => g.lane);
    let lane = 0;
    while (busy.includes(lane)) lane++;
    const entry = { session, lane, lanes: 1 };
    group.push(entry);
    placed.push(entry);
    if (session.end > groupEnd) groupEnd = session.end;
  }
  if (group.length) closeGroup();
  return placed;
}

if (typeof module !== "undefined") module.exports = {
  nowAndNext, weekStartOf, layoutDay, hourOf, plusHours,
  parseUniboDate, examPublishedDetails, mergeExamSittings,
  examSittingIdentity, examCalendarTimes,
  timetableClassroomRecord, timetableClassroomText, timetableClassroomsText,
  requestOfficialTimetable, fetchTimetable, timetableRequestUrls,
  requestOfficialExams, nextExamPage, publishedAcademicCopy,
};
