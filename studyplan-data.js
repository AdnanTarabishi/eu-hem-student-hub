// ===== The two-year study journey: pure data and draft helpers =====
// Semester 1 keeps its existing programme.js plan. This separate draft stores the
// choices for Semesters 2–4 without changing today's timetable or exam filters.
// Facts come from the supplied tracks cohort; missing credits stay unknown.

const StudyPlanData = (() => {
  "use strict";

  const DRAFT_KEY = "euhem-study-journey-v1";
  const COURSE_STATUSES = ["", "studying", "booked", "passed"];
  const THESIS_STATUSES = ["", "planning", "researching", "writing", "submitted", "completed"];
  const THESIS_TOPIC_MAX = 300;

  function trackOf(cohort, trackOrId) {
    const id = typeof trackOrId === "string" ? trackOrId : trackOrId?.id;
    return cohort?.tracks?.find((track) => track.id === id) || null;
  }

  function semesterOf(track, number) {
    return track?.semesters?.find((semester) => semester.number === Number(number)) || null;
  }

  function choiceKey(semester, choiceIndex) {
    return `s${Number(semester)}-choice-${Number(choiceIndex)}`;
  }

  // Exact titles after normalising punctuation, spaces and ampersands. This is
  // deliberately not a fuzzy match: similarly named courses are not equivalent.
  function normalizedTitle(value) {
    return typeof value === "string"
      ? value.normalize("NFKC").toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim()
      : "";
  }

  function s1Keys(selections) {
    const codes = new Set();
    const names = new Set();
    for (const selection of Array.isArray(selections) ? selections : []) {
      if (typeof selection === "string") codes.add(selection.trim());
      else if (selection && typeof selection === "object") {
        if (typeof selection.code === "string") codes.add(selection.code.trim());
        const title = normalizedTitle(selection.name || selection.title);
        if (title) names.add(title);
      }
    }
    return { codes, names };
  }

  function courseInfo(cohort, id, semester) {
    const source = cohort?.courses?.[id];
    if (!source) return null;
    return {
      ...source,
      id,
      semester: Number(semester),
      credits: Number.isFinite(source.credits) && source.credits > 0 ? source.credits : null,
    };
  }

  // Only supported, explicit official rules receive a enforceable limit. An
  // unspecified rule remains a draft preference rather than a confirmed plan.
  function ruleModel(rule) {
    if (typeof rule !== "string") return { kind: "unknown", target: null };
    const text = rule.trim().toLowerCase().replace(/\s+/g, " ");
    if (/^choose one(?: option| pair)?$/.test(text)) return { kind: "count", target: 1 };
    if (/^choose two(?: options)?$/.test(text)) return { kind: "count", target: 2 };
    const match = text.match(/^choose (\d+(?:\.\d+)?) (?:ec|ects|cfu)$/);
    if (match && Number(match[1]) > 0) return { kind: "credits", target: Number(match[1]) };
    return { kind: "unknown", target: null };
  }

  function courseCreditSummary(courses) {
    return {
      knownCredits: courses.reduce((total, course) => total + (course.credits ?? 0), 0),
      unknownCredits: courses.filter((course) => course.credits === null).length,
      unknownCourseIds: courses.filter((course) => course.credits === null).map((course) => course.id),
    };
  }

  function choiceOptions(cohort, semester, choice, selections) {
    const previous = s1Keys(selections);
    return (choice?.options || []).map((ids, index) => {
      const courses = ids.map((id) => courseInfo(cohort, id, semester.number)).filter(Boolean);
      const repeated = courses.find((course) => {
        const note = choice.notes?.[course.id];
        const disallowsRepeat = typeof note === "string" && /^if not taken in semester\s*1\.?$/i.test(note.trim());
        return disallowsRepeat && (
          (typeof course.code === "string" && previous.codes.has(course.code.trim())) ||
          previous.names.has(normalizedTitle(course.name))
        );
      });
      const missingCourse = courses.length !== ids.length;
      return {
        index,
        courses,
        ...courseCreditSummary(courses),
        blocked: !!repeated || missingCourse,
        blockedKind: repeated ? "duplicate" : missingCourse ? "missing-course" : "",
        reason: repeated ? `${repeated.name} is already in your Semester 1 plan.`
          : missingCourse ? "Course details are unavailable. Check the official curriculum." : "",
        notes: ids.map((id) => choice.notes?.[id]).filter(Boolean),
      };
    });
  }

  function cleanChoice(cohort, semester, choice, raw, selections) {
    const options = choiceOptions(cohort, semester, choice, selections);
    const model = ruleModel(choice.rule);
    const requested = new Set(Array.isArray(raw) ? raw.filter(Number.isInteger) : []);
    const picked = [];
    let knownCredits = 0;
    for (const option of options) {
      if (!requested.has(option.index) || option.blocked) continue;
      if (model.kind === "count" && picked.length >= model.target) continue;
      if (model.kind === "credits" && knownCredits + option.knownCredits > model.target) continue;
      picked.push(option.index);
      knownCredits += option.knownCredits;
    }
    return picked;
  }

  function selectedCoursesFromTrack(cohort, track, choices, selections) {
    const courses = [];
    const seen = new Set();
    function add(id, semester, required, key = null, optionIndex = null) {
      const course = courseInfo(cohort, id, semester.number);
      if (!course || seen.has(id)) return;
      seen.add(id);
      courses.push({ ...course, required, choiceKey: key, optionIndex });
    }
    for (const semester of track.semesters || []) {
      for (const id of semester.required || []) add(id, semester, true);
      (semester.choices || []).forEach((choice, index) => {
        const key = choiceKey(semester.number, index);
        const picked = cleanChoice(cohort, semester, choice, choices?.[key], selections);
        for (const optionIndex of picked) {
          for (const id of choice.options[optionIndex]) add(id, semester, false, key, optionIndex);
        }
      });
    }
    return courses;
  }

  function cleanTrack(cohort, track, raw, selections) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const choices = {};
    for (const semester of track.semesters || []) {
      (semester.choices || []).forEach((choice, index) => {
        const key = choiceKey(semester.number, index);
        choices[key] = cleanChoice(cohort, semester, choice, source.choices?.[key], selections);
      });
    }
    const selectedIds = new Set(selectedCoursesFromTrack(cohort, track, choices, selections).map((course) => course.id));
    const statuses = {};
    if (source.statuses && typeof source.statuses === "object") {
      for (const [id, status] of Object.entries(source.statuses)) {
        if (selectedIds.has(id) && status && COURSE_STATUSES.includes(status)) statuses[id] = status;
      }
    }
    return {
      choices,
      statuses,
      thesisUniversity: (track.thesis || []).includes(source.thesisUniversity) ? source.thesisUniversity : "",
      thesisStatus: THESIS_STATUSES.includes(source.thesisStatus) ? source.thesisStatus : "",
      thesisTopic: typeof source.thesisTopic === "string" ? source.thesisTopic.trim().slice(0, THESIS_TOPIC_MAX) : "",
    };
  }

  function sanitizeDraft(cohort, raw, s1Selections = []) {
    const valid = raw && typeof raw === "object" && !Array.isArray(raw)
      && (raw.version === undefined || raw.version === 1)
      && (raw.cohort === undefined || raw.cohort === cohort.id);
    const source = valid ? raw : {};
    const tracks = {};
    for (const track of cohort.tracks || []) tracks[track.id] = cleanTrack(cohort, track, source.tracks?.[track.id], s1Selections);
    return { version: 1, cohort: cohort.id, tracks };
  }

  function isEnvelope(raw) {
    return !!raw && typeof raw === "object"
      && ["tracks", "cohort", "version"].some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  }

  // UI callers may pass either the whole journey draft or this track's slice.
  function trackDraft(cohort, trackOrId, raw, s1Selections = []) {
    const track = trackOf(cohort, trackOrId);
    if (!track) return null;
    if (isEnvelope(raw)) return sanitizeDraft(cohort, raw, s1Selections).tracks[track.id];
    return cleanTrack(cohort, track, raw, s1Selections);
  }

  function choiceState(cohort, trackOrId, semesterNumber, choiceIndex, raw, s1Selections = []) {
    const track = trackOf(cohort, trackOrId);
    const semester = semesterOf(track, semesterNumber);
    const choice = semester?.choices?.[choiceIndex];
    if (!track || !semester || !choice) return null;
    const draft = trackDraft(cohort, track, raw, s1Selections);
    const key = choiceKey(semester.number, choiceIndex);
    const selected = draft.choices[key];
    const options = choiceOptions(cohort, semester, choice, s1Selections);
    const model = ruleModel(choice.rule);
    const pickedCourses = options.filter((option) => selected.includes(option.index)).flatMap((option) => option.courses);
    const creditSummary = courseCreditSummary(pickedCourses);
    let complete = null;
    if (model.kind === "count") complete = selected.length === model.target;
    if (model.kind === "credits") complete = creditSummary.unknownCredits ? null : creditSummary.knownCredits === model.target;
    const notice = model.kind === "unknown"
      ? "The selection rule is not specified in the available curriculum. Save preferences and confirm the rule with the host university."
      : model.kind === "credits" && creditSummary.unknownCredits
        ? "Selected course credits are not all published in the available overview. Confirm them before checking this credit requirement."
        : "";
    return {
      key,
      kind: choice.kind,
      rule: choice.rule || null,
      ruleModel: model,
      options,
      selected,
      complete,
      ...creditSummary,
      notice,
      notes: semester.choicesNote || "",
    };
  }

  // A one-option or one-pair pick replaces the old option. A bundle is always
  // selected together. Count and known-credit overshoots are refused explicitly.
  function applyFutureChoice(cohort, trackOrId, semesterNumber, choiceIndex, raw, optionIndex, selected, s1Selections = []) {
    const track = trackOf(cohort, trackOrId);
    const envelope = isEnvelope(raw) ? raw : { tracks: { [track?.id]: raw } };
    let draft = sanitizeDraft(cohort, envelope, s1Selections);
    const state = choiceState(cohort, track, semesterNumber, choiceIndex, draft, s1Selections);
    const option = state?.options.find((item) => item.index === optionIndex);
    const result = (refused, reason = "") => ({ draft, trackDraft: track ? draft.tracks[track.id] : null, refused, reason });
    if (!state || !option) return result(true, "This course option is unavailable.");
    if (selected && option.blocked) return result(true, option.reason);
    let picked = [...state.selected];
    if (!selected) picked = picked.filter((index) => index !== optionIndex);
    else if (!picked.includes(optionIndex)) {
      if (state.ruleModel.kind === "count" && state.ruleModel.target === 1) picked = [optionIndex];
      else {
        if (state.ruleModel.kind === "count" && picked.length >= state.ruleModel.target) {
          return result(true, `Choose only ${state.ruleModel.target} options in this group. Remove an option first.`);
        }
        if (state.ruleModel.kind === "credits" && state.knownCredits + option.knownCredits > state.ruleModel.target) {
          return result(true, `This option would exceed the ${state.ruleModel.target} EC requirement using known credits.`);
        }
        picked.push(optionIndex);
      }
    }
    draft.tracks[track.id].choices[state.key] = picked;
    // Removes a status when its course is removed, and keeps other tracks intact.
    draft = sanitizeDraft(cohort, draft, s1Selections);
    return result(false);
  }

  function selectedFutureCourses(cohort, trackOrId, raw, s1Selections = []) {
    const track = trackOf(cohort, trackOrId);
    if (!track) return [];
    const draft = trackDraft(cohort, track, raw, s1Selections);
    return selectedCoursesFromTrack(cohort, track, draft.choices, s1Selections);
  }

  function semesterSummary(cohort, trackOrId, semesterNumber, raw, s1Selections = []) {
    const track = trackOf(cohort, trackOrId);
    const semester = semesterOf(track, semesterNumber);
    if (!track || !semester) return null;
    const courses = selectedFutureCourses(cohort, track, raw, s1Selections).filter((course) => course.semester === semester.number);
    const choiceStates = (semester.choices || []).map((_, index) => choiceState(cohort, track, semester.number, index, raw, s1Selections));
    const creditSummary = courseCreditSummary(courses);
    const choicesComplete = choiceStates.some((state) => state.complete === false) ? false
      : choiceStates.some((state) => state.complete === null) ? null : true;
    return {
      semester: semester.number,
      university: semester.university,
      courses,
      ...creditSummary,
      choiceStates,
      choicesComplete,
      // Credits absent from the source cannot establish semester completeness.
      complete: choicesComplete === false ? false : creditSummary.unknownCredits || choicesComplete === null ? null : true,
    };
  }

  return {
    DRAFT_KEY,
    COURSE_STATUSES,
    THESIS_STATUSES,
    THESIS_TOPIC_MAX,
    normalizedTitle,
    choiceKey,
    ruleModel,
    sanitizeDraft,
    trackDraft,
    choiceState,
    applyFutureChoice,
    selectedFutureCourses,
    semesterSummary,
  };
})();

if (typeof module !== "undefined") module.exports = StudyPlanData;
