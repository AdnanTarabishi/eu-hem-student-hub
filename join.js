// ===== Join the Directory: onboarding v2 =====
// One form for four kinds of people (directory-options.js → userTypes). Only the fields of the chosen
// connection to EU-HEM are shown, checked and sent. The server (Code.gs) checks everything again and
// decides directory eligibility itself; nothing here can make someone eligible or a profile public.
(() => {
  "use strict";

  const form = document.getElementById("directoryForm");
  if (!form) return;

  const config = window.EUHEM_DIRECTORY_CONFIG || {};
  const { OPTIONS, VIS_RULES, FIELD_GROUPS } = window.EUHEM_DIRECTORY_OPTIONS;
  const endpoint = String(config.endpoint || "").trim();
  const SUBMIT_TIMEOUT_MS = 60000;
  const STEP_COUNT = 3;
  const BIO_MAX = 350;

  const $ = (id) => document.getElementById(id);
  const steps = [...document.querySelectorAll(".form-step")];
  const stepLabels = [...document.querySelectorAll("[data-step-label]")];
  const messageBox = $("formMessage");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // One id for the whole visit, so a retry after a lost connection is recognised
  // by the server and never saved twice.
  const requestId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
  const openedAt = performance.now();

  let currentStep = 1;
  let submitting = false;
  let photo = null; // { base64, type, objectUrl }
  let trackNames = { ...OPTIONS.currentTracks }; // replaced by content/tracks.json when it loads

  const countries = [
    "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
    "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
    "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
    "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
    "Côte d’Ivoire","Croatia","Cuba","Cyprus","Czechia","Democratic Republic of the Congo","Denmark","Djibouti","Dominica",
    "Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
    "Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
    "Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
    "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon",
    "Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives",
    "Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia",
    "Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua",
    "Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama",
    "Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda",
    "Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","São Tomé and Príncipe",
    "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands",
    "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
    "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
    "Türkiye","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
    "Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
  ];

  /* ---------- the chosen connection to EU-HEM ---------- */

  const userType = () => form.querySelector('input[name="userType"]:checked')?.value || "";
  const isDirectory = () => OPTIONS.directoryEligible[userType()] === true;

  // A field counts when it belongs to the chosen user type (data-roles) and its condition holds
  // (data-when). Which step is on screen does not matter: the final check runs on all three steps.
  function isShown(el) {
    for (let node = el; node && node !== form; node = node.parentElement) {
      if (node.hidden && !node.classList.contains("form-step")) return false;
    }
    return true;
  }

  function conditionHolds(when) {
    const [name, value] = when.split("=");
    if (name === "feature") return !!form.querySelector(`input[name="featureInterests"][value="${value}"]:checked`);
    return $(name)?.value === value;
  }

  function refreshVisibility() {
    const role = userType();
    $("roleFields").hidden = !role;
    for (const el of form.querySelectorAll("[data-roles], [data-when]")) {
      const roleOk = !el.dataset.roles || el.dataset.roles.split(" ").includes(role);
      const whenOk = !el.dataset.when || conditionHolds(el.dataset.when);
      el.hidden = !(roleOk && whenOk);
    }
  }

  const ROLE_TEXT = {
    current_student: { announce: "Questions for current EU-HEM students are shown below.",
      emailHelp: "An institutional or university email is preferred and helps us verify your connection to the programme." },
    alumni: { announce: "Questions for EU-HEM alumni are shown below.",
      emailHelp: "A university email is preferred if you still have access to it. Otherwise, you may use your current email." },
    shared_course_student: { announce: "Questions for students from another programme are shown below.",
      emailHelp: "An institutional or university email is preferred and helps us verify your connection to the programme." },
    faculty_staff: { announce: "Questions for faculty, staff and partners are shown below.",
      emailHelp: "An institutional or work email is preferred and helps us verify your connection to the programme." }
  };

  function applyUserType() {
    const role = userType();
    const directory = isDirectory();
    $("roleAnnouncer").textContent = ROLE_TEXT[role]?.announce || "";
    $("emailHelp").textContent = ROLE_TEXT[role]?.emailHelp || "";
    buildCohortOptions(role);
    buildTrackOptions(role);
    $("trackLabel").firstChild.textContent = role === "alumni" ? "Track / specialisation " : "EU-HEM track ";
    $("step2Title").textContent = directory ? "Your profile & Student Hub preferences" : "Student Hub preferences";
    $("step2Lead").textContent = directory
      ? "Everything here is optional. Skip anything you don't want to add."
      : "Optional: add your LinkedIn and tell us what you'd like from the Student Hub.";
    $("step3Lead").textContent = directory
      ? "Choose who may eventually see your profile. Nothing is published automatically."
      : "Review the privacy information and confirm your registration.";
    $("submitButtonText").textContent = directory ? "Join the Directory" : "Submit registration";
    stepLabels[1].textContent = directory ? "Profile & preferences" : "Preferences";
    refreshVisibility();
    updatePrivacyControls();
  }

  /* ---------- lists built from directory-options.js and config ---------- */

  const option = (value, label) => new Option(label, value);

  function fillSelect(select, placeholder, items) {
    const keep = select.value;
    select.replaceChildren(option("", placeholder), ...items);
    if ([...select.options].some((o) => o.value === keep)) select.value = keep;
  }

  function group(label, entries) {
    const g = document.createElement("optgroup");
    g.label = label;
    g.append(...entries.map(([value, text]) => option(value, text)));
    return g;
  }

  function buildCohortOptions(role) {
    const cohorts = config.cohorts || {};
    const items = role === "alumni"
      ? (cohorts.alumni || []).map((c) => option(c, c))
      : [...(cohorts.current || []).map((c) => option(c, c)), ...(cohorts.upcoming || []).map((c) => option(c, `${c} (starting)`))];
    fillSelect($("cohort"), "Choose your cohort…", [...items, option("other", "Other / not listed")]);
  }

  function buildTrackOptions(role) {
    const current = Object.keys(OPTIONS.currentTracks).map((id) => [id, trackNames[id] || OPTIONS.currentTracks[id]]);
    const items = role === "alumni"
      ? [group("Current tracks", current), group("Earlier specialisations", Object.entries(OPTIONS.legacyTracks)),
         option("other_former", OPTIONS.trackChoices.other_former), option("prefer_not_to_share", OPTIONS.trackChoices.prefer_not_to_share)]
      : [...current.map(([id, label]) => option(id, label)),
         option("not_chosen", OPTIONS.trackChoices.not_chosen), option("prefer_not_to_share", OPTIONS.trackChoices.prefer_not_to_share)];
    fillSelect($("track"), role === "alumni" ? "Choose your track or specialisation…" : "Choose your track…", items);
  }

  function buildStaticLists() {
    $("countryList").replaceChildren(...countries.map((country) => new Option("", country)));
    fillSelect($("previousField"), "Choose a field…",
      FIELD_GROUPS.map((g) => (g.ids.length === 1 && g.ids[0] === "other"
        ? option("other", OPTIONS.academicFields.other)
        : group(g.label, g.ids.map((id) => [id, OPTIONS.academicFields[id]])))));
    fillSelect($("previousDegree"), "Choose a degree (optional)…", Object.entries(OPTIONS.degrees).map(([id, label]) => option(id, label)));
    fillSelect($("programmeRole"), "Choose your role…", Object.entries(OPTIONS.programmeRoles).map(([id, label]) => option(id, label)));
    $("featureChips").replaceChildren(...Object.entries(OPTIONS.features).map(([id, label]) => {
      const chip = document.createElement("label");
      chip.className = "feature-chip";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.name = "featureInterests";
      box.value = id;
      chip.append(box, document.createTextNode(label));
      return chip;
    }));
  }

  // Current track names come from content/tracks.json (one source for the whole site)
  async function loadTrackNames() {
    try {
      const file = await (await fetch("content/tracks.json")).json();
      const cohort = file.cohorts[file.cohorts.length - 1];
      for (const track of cohort.tracks) if (OPTIONS.currentTracks[track.id]) trackNames[track.id] = track.name;
      if (userType()) buildTrackOptions(userType());
    } catch (error) {
      console.warn("Track names from directory-options.js are used:", error);
    }
  }

  // The shared courses are the Semester 1 courses in content/programme.json
  async function loadSharedCourses() {
    const list = $("sharedCourseList");
    try {
      const term = currentTerm(await loadProgramme());
      const names = [...new Set(term.courses.map((course) => course.name))];
      list.replaceChildren(...names.map((name) => {
        const label = document.createElement("label");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.name = "sharedCourses";
        box.value = name;
        label.append(box, document.createTextNode(name));
        return label;
      }));
    } catch (error) {
      console.warn("Course list could not be loaded:", error);
      list.textContent = "Please type your course(s) below.";
    }
  }

  /* ---------- steps ---------- */

  function setStep(next, { focus = true } = {}) {
    currentStep = Math.min(STEP_COUNT, Math.max(1, next));
    steps.forEach((step) => {
      const active = Number(step.dataset.step) === currentStep;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    stepLabels.forEach((label) => {
      const active = Number(label.dataset.stepLabel) === currentStep;
      label.classList.toggle("is-active", active);
      if (active) label.setAttribute("aria-current", "step"); else label.removeAttribute("aria-current");
    });
    const pct = Math.round((currentStep / STEP_COUNT) * 100);
    $("progressFill").style.width = `${pct}%`;
    $("progressLabel").textContent = `Step ${currentStep} of ${STEP_COUNT}`;
    $("progressPercent").textContent = `${pct}%`;

    if (!focus) return; // first paint: do not move the page or steal focus
    const heading = steps[currentStep - 1].querySelector("h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    document.querySelector(".form-shell").scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  /* ---------- validation (only what is shown) ---------- */

  function resetErrors(scope) {
    scope.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
      el.removeAttribute("aria-invalid");
      if (el.dataset.describedby !== undefined) el.setAttribute("aria-describedby", el.dataset.describedby);
    });
    scope.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; });
  }

  function fail(inputId, text) {
    const input = $(inputId);
    const error = $(`${inputId}Error`);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      if (input.dataset.describedby === undefined) input.dataset.describedby = input.getAttribute("aria-describedby") || "";
      if (error) input.setAttribute("aria-describedby", `${input.dataset.describedby} ${error.id}`.trim());
    }
    if (error) error.textContent = text;
    return false;
  }

  const shownValue = (id) => ($(id) && isShown($(id)) ? $(id).value.trim() : "");
  const needs = (id, text) => (isShown($(id)) && !$(id).value.trim() ? fail(id, text) : true);

  const validators = {
    1() {
      resetErrors(steps[0]);
      if (!userType()) {
        $("userTypeError").textContent = "Please choose how you are connected to EU-HEM.";
        return false;
      }
      let ok = true;
      ok = needs("fullName", "Please enter your full name.") && ok;
      const email = $("email").value.trim();
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) ok = fail("email", "Please enter a valid email address.");
      ok = needs("cohort", "Please choose your EU-HEM cohort.") && ok;
      ok = needs("cohortOther", "Please type your cohort, for example 2017–2019.") && ok;
      ok = needs("primaryCountry", "Please select or enter a country.") && ok;
      ok = needs("previousField", "Please choose your previous academic field.") && ok;
      ok = needs("previousFieldOther", "Please specify your academic field.") && ok;
      ok = needs("track", userType() === "alumni" ? "Please choose your track or specialisation." : "Please choose your EU-HEM track.") && ok;
      ok = needs("trackOther", "Please type your former specialisation.") && ok;
      ok = needs("homeInstitution", "Please enter your home institution.") && ok;
      ok = needs("homeProgramme", "Please enter your home programme.") && ok;
      if (isShown($("sharedCourses")) && !sharedCourses().length) {
        ok = fail("sharedCourses", "Please choose or type at least one course.");
      }
      ok = needs("organisation", "Please enter your institution or organisation.") && ok;
      ok = needs("programmeRole", "Please choose your role.") && ok;
      ok = needs("programmeRoleOther", "Please specify your role.") && ok;
      return ok;
    },
    2() {
      resetErrors(steps[1]);
      let ok = true;
      const linkedin = $("linkedin").value.trim();
      if (linkedin && !/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/\S*$/i.test(linkedin)) {
        ok = fail("linkedin", "Please enter a LinkedIn address starting with https://www.linkedin.com/");
      }
      ok = needs("previousDegreeOther", "Please specify your degree.") && ok;
      return ok;
    },
    3() {
      resetErrors(steps[2]);
      let ok = true;
      if (isDirectory()) {
        if (!form.querySelector('input[name="profileVisibility"]:checked')) {
          $("profileVisibilityError").textContent = "Please choose who can see your profile."; ok = false;
        }
        if (!form.querySelector('input[name="analyticsConsent"]:checked')) {
          $("analyticsConsentError").textContent = "Please choose Yes or No."; ok = false;
        }
      }
      if (!$("privacyAcknowledgement").checked) {
        $("privacyAcknowledgementError").textContent = "Please review and acknowledge the privacy information."; ok = false;
      }
      return ok;
    }
  };

  function focusFirstError(stepNumber) {
    const scope = steps[stepNumber - 1];
    const target = scope.querySelector('[aria-invalid="true"]') ||
      [...scope.querySelectorAll(".field-error")].find((el) => el.textContent)?.closest("fieldset, label, .field")?.querySelector("input, select");
    if (target) target.focus();
  }

  document.querySelectorAll("[data-next]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (validators[currentStep]()) setStep(currentStep + 1);
      else focusFirstError(currentStep);
    });
  });
  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => setStep(currentStep - 1));
  });

  form.querySelectorAll('input[name="userType"]').forEach((radio) => radio.addEventListener("change", applyUserType));
  for (const id of ["cohort", "previousField", "track", "programmeRole", "previousDegree"]) {
    $(id).addEventListener("change", refreshVisibility);
  }

  $("shortBio").addEventListener("input", () => {
    $("bioCounter").textContent = `${$("shortBio").value.length} / ${BIO_MAX}`;
  });

  $("featureChips").addEventListener("change", () => {
    const count = form.querySelectorAll('input[name="featureInterests"]:checked').length;
    $("featureCount").textContent = `${count} selected`;
    refreshVisibility();
  });

  const sharedCourses = () => [...form.querySelectorAll('input[name="sharedCourses"]:checked')].map((box) => box.value)
    .concat($("sharedCoursesOther").value.trim() ? ["other"] : []);

  /* ---------- privacy controls (rules in directory-options.js, enforced again by the server) ---------- */

  const VIS_LABEL = { public: "Public", cohort: "EU-HEM members only", hidden: "Hidden" };
  const profileVisibility = () => form.querySelector('input[name="profileVisibility"]:checked')?.value || "";

  function updatePrivacyControls(useDefaults) {
    const profile = profileVisibility();
    for (const kind of ["photo", "linkedin", "email"]) {
      const select = $(`${kind}Visibility`);
      if (!profile) {
        select.replaceChildren(option("", "Choose a profile setting first"));
        select.disabled = true;
        continue;
      }
      select.disabled = false;
      const allowed = VIS_RULES[profile][kind];
      const fallback = kind === "email" ? "hidden" : allowed[0];
      const wanted = useDefaults ? fallback : (select.value || fallback);
      select.replaceChildren(...allowed.map((value) => option(value, VIS_LABEL[value])));
      select.value = allowed.includes(wanted) ? wanted : allowed[allowed.length - 1];
    }
    updatePrivacySummary();
  }

  function updatePrivacySummary() {
    const profile = profileVisibility();
    const summary = $("privacySummary");
    summary.hidden = !isDirectory() || !profile;
    if (summary.hidden) return;
    const title = document.createElement("strong");
    title.textContent = `Current profile setting: ${{ public: "Public", cohort: "EU-HEM students only", hidden: "Do not publish yet" }[profile]}`;
    const text = document.createElement("span");
    text.textContent = {
      public: " After you confirm your email and the profile is reviewed, only the details you set to Public may appear on the public Student Hub.",
      cohort: " Your profile stays private until a secure login for EU-HEM members exists.",
      hidden: " Your individual profile will not be displayed anywhere."
    }[profile] + " Nothing is published automatically.";
    summary.replaceChildren(title, text);
  }

  form.querySelectorAll('input[name="profileVisibility"]').forEach((radio) => {
    radio.addEventListener("change", () => updatePrivacyControls(true));
  });

  /* ---------- photo ---------- */

  const canvasBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  async function compressPhoto(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Please choose a JPEG, PNG or WebP image.");
    if (file.size > 12 * 1024 * 1024) throw new Error("This image is too large. Please choose an image under 12 MB.");

    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error("We could not read this image. Please try another photo."); }

    // A profile photo does not need more than 800 pixels. Drawing to a canvas
    // also removes hidden data such as the GPS location stored by phone cameras.
    const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();

    for (const quality of [0.85, 0.75, 0.65, 0.5]) {
      const blob = await canvasBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= 600 * 1024) return blob;
    }
    throw new Error("We could not make this photo small enough. Please choose another one.");
  }

  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("We could not read this image."));
    reader.readAsDataURL(blob);
  });

  function clearPhoto() {
    if (photo?.objectUrl) URL.revokeObjectURL(photo.objectUrl);
    photo = null;
    $("profilePhoto").value = "";
    $("photoImage").removeAttribute("src");
    $("photoImage").hidden = true;
    $("photoPlaceholder").hidden = false;
    $("removePhoto").hidden = true;
    $("photoStatus").textContent = "";
  }

  $("profilePhoto").addEventListener("change", async (event) => {
    $("profilePhotoError").textContent = "";
    const file = event.target.files?.[0];
    if (!file) return;
    $("photoStatus").textContent = "Preparing your photo…";
    try {
      const blob = await compressPhoto(file);
      const base64 = await blobToBase64(blob);
      clearPhoto();
      photo = { base64, type: "image/jpeg", objectUrl: URL.createObjectURL(blob) };
      $("photoImage").src = photo.objectUrl;
      $("photoImage").hidden = false;
      $("photoPlaceholder").hidden = true;
      $("removePhoto").hidden = false;
      $("photoStatus").textContent = `Ready to upload · ${Math.round(blob.size / 1024)} KB`;
    } catch (error) {
      clearPhoto();
      $("profilePhotoError").textContent = error.message || "Could not process this photo.";
    }
  });
  $("removePhoto").addEventListener("click", clearPhoto);

  /* ---------- submit ---------- */

  // Only the fields of the chosen user type are sent; the server ignores anything else.
  function buildPayload() {
    const checked = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
    const directory = isDirectory();
    const payload = {
      requestId,
      elapsedMs: Math.round(performance.now() - openedAt),
      website: $("website").value.trim(),
      consentVersion: config.consentVersion || "",
      userType: userType(),
      fullName: shownValue("fullName"),
      email: shownValue("email").toLowerCase(),
      linkedin: shownValue("linkedin"),
      featureInterests: [...form.querySelectorAll('input[name="featureInterests"]:checked')].map((box) => box.value),
      featureSuggestion: shownValue("featureSuggestion"),
      privacyAcknowledgement: $("privacyAcknowledgement").checked ? "yes" : ""
    };
    for (const id of ["cohort", "cohortOther", "primaryCountry", "previousField", "previousFieldOther", "track", "trackOther",
      "homeInstitution", "homeProgramme", "sharedCoursesOther", "organisation", "programmeRole", "programmeRoleOther",
      "coursesInvolved", "additionalCountry", "previousDegree", "previousDegreeOther", "previousUniversity", "shortBio"]) {
      const value = shownValue(id);
      if (value) payload[id] = value;
    }
    if (isShown($("sharedCourses"))) payload.sharedCourses = sharedCourses().filter((c) => c !== "other");
    if (directory) {
      Object.assign(payload, {
        profileVisibility: profileVisibility(),
        photoVisibility: $("photoVisibility").value || "hidden",
        linkedinVisibility: $("linkedinVisibility").value || "hidden",
        emailVisibility: $("emailVisibility").value || "hidden",
        analyticsConsent: checked("analyticsConsent"),
        photoBase64: photo ? photo.base64 : "",
        photoMimeType: photo ? photo.type : ""
      });
    }
    return payload;
  }

  function setSubmitting(on) {
    submitting = on;
    $("submitButton").disabled = on;
    $("submitSpinner").hidden = !on;
    $("submitButtonText").textContent = on ? "Sending…" : (isDirectory() ? "Join the Directory" : "Submit registration");
  }

  function showMessage(text) {
    messageBox.textContent = text;
    if (text) messageBox.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  function showSuccess(result) {
    const profile = profileVisibility();
    if (result.confirmation === "failed") {
      $("successConfirmText").textContent = "We could not send the confirmation email, so the Student Hub team will verify your address manually.";
    } else if (result.confirmation === "not_required") {
      $("successConfirmText").textContent = "Your registration is waiting for review.";
    }
    $("successVisibilityText").textContent = !isDirectory()
      ? "Your registration will not be added to the Student Directory."
      : {
        public: "Nothing will appear publicly until your email is confirmed and the profile has been reviewed.",
        cohort: "Your profile will remain private and can later appear only to verified EU-HEM members.",
        hidden: "Your information has been saved, but your individual profile will not be displayed."
      }[profile];
    form.hidden = true;
    document.querySelector(".progress-card").hidden = true;
    clearPhoto();
    $("successCard").hidden = false;
    $("successCard").focus();
  }

  // Apps Script cannot answer a CORS preflight. A "text/plain" body is a simple
  // request, so the browser sends it directly and can read the JSON reply.
  async function send(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow",
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    showMessage("");

    for (const step of [1, 2, 3]) {
      if (!validators[step]()) {
        if (currentStep !== step) setStep(step);
        focusFirstError(step);
        return;
      }
    }

    if (!endpoint) {
      showMessage("Registration is not open yet. Please come back soon.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await send(buildPayload());
      if (result && result.ok) { showSuccess(result); return; }
      showMessage((result && result.message) || "We could not send your registration. Please try again.");
    } catch (error) {
      showMessage(error.name === "AbortError"
        ? "Sending took too long. Please check your connection and press the button again. Your registration will not be saved twice."
        : "We could not reach the server. Please check your connection and press the button again. Your registration will not be saved twice.");
    } finally {
      setSubmitting(false);
    }
  });

  /* ---------- start ---------- */

  buildStaticLists();
  refreshVisibility();
  updatePrivacyControls(true);
  setStep(1, { focus: false });
  loadTrackNames();
  loadSharedCourses();
})();
