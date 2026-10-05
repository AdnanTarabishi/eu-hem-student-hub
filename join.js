(() => {
  "use strict";

  const form = document.getElementById("directoryForm");
  if (!form) return;

  const config = window.EUHEM_DIRECTORY_CONFIG || {};
  const endpoint = String(config.endpoint || "").trim();
  const allowedDomains = (config.allowedEmailDomains || []).map((d) => String(d).toLowerCase());
  const collectPhone = config.collectPhone === true;
  const SUBMIT_TIMEOUT_MS = 60000;
  const STEP_COUNT = 3;

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

  /* ---------- validation ---------- */

  function resetErrors(scope) {
    scope.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute("aria-invalid"));
    scope.querySelectorAll(".field-error").forEach((el) => { el.textContent = ""; });
  }

  function fail(inputId, text) {
    const input = $(inputId);
    const error = $(`${inputId}Error`);
    if (input) {
      input.setAttribute("aria-invalid", "true");
      if (error) input.setAttribute("aria-describedby", error.id);
    }
    if (error) error.textContent = text;
    return false;
  }

  function emailProblem(email) {
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return "Please enter a valid university email.";
    const domain = email.split("@")[1].toLowerCase();
    if (allowedDomains.length && !allowedDomains.includes(domain)) {
      return `Please use your university email (${allowedDomains.map((d) => `@${d}`).join(" or ")}).`;
    }
    return "";
  }

  const validators = {
    1() {
      resetErrors(steps[0]);
      let ok = true;
      if (!$("fullName").value.trim()) ok = fail("fullName", "Please enter your full name.");
      const problem = emailProblem($("universityEmail").value.trim());
      if (problem) ok = fail("universityEmail", problem);
      if (!$("primaryCountry").value.trim()) ok = fail("primaryCountry", "Please select or enter a country.");
      const field = $("previousField").value;
      if (!field) ok = fail("previousField", "Please choose your previous academic field.");
      if (field === "Other" && !$("previousFieldOther").value.trim()) {
        ok = fail("previousFieldOther", "Please specify your academic field.");
      }
      if (!$("euhemTrack").value) ok = fail("euhemTrack", "Please choose your EU-HEM track or “Not decided yet”.");
      return ok;
    },
    2() {
      resetErrors(steps[1]);
      let ok = true;
      const linkedin = $("linkedin").value.trim();
      if (linkedin && !/^https:\/\/([a-z0-9-]+\.)?linkedin\.com\/\S*$/i.test(linkedin)) {
        ok = fail("linkedin", "Please enter a LinkedIn address starting with https://www.linkedin.com/");
      }
      const instagram = $("instagram").value.trim();
      if (instagram && !/^(?:https?:\/\/(?:www\.)?instagram\.com\/|@)?[A-Za-z0-9._]{1,30}\/?(?:\?.*)?$/.test(instagram)) {
        ok = fail("instagram", "Please enter an Instagram username such as @name.");
      }
      const phone = collectPhone ? $("phone").value.trim() : "";
      if (phone && !/^\+?[0-9][0-9 ()\-]{5,24}$/.test(phone)) {
        ok = fail("phone", "Please enter a valid phone number, for example +39 333 1234567.");
      }
      return ok;
    },
    3() {
      resetErrors(steps[2]);
      let ok = true;
      if (!form.querySelector('input[name="profileVisibility"]:checked')) {
        $("profileVisibilityError").textContent = "Please choose who can see your profile."; ok = false;
      }
      if (!form.querySelector('input[name="analyticsConsent"]:checked')) {
        $("analyticsConsentError").textContent = "Please choose Yes or No."; ok = false;
      }
      if (!$("privacyAcknowledgement").checked) {
        $("privacyAcknowledgementError").textContent = "Please review and acknowledge the Directory privacy information."; ok = false;
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

  $("previousField").addEventListener("change", () => {
    const other = $("previousField").value === "Other";
    $("previousFieldOtherWrap").classList.toggle("is-hidden", !other);
    if (!other) $("previousFieldOther").value = "";
  });

  $("shortBio").addEventListener("input", () => {
    $("bioCounter").textContent = `${$("shortBio").value.length} / 250`;
  });

  /* ---------- privacy controls ---------- */

  const VIS_LABEL = { public: "Public", cohort: "EU-HEM students only", hidden: "Hidden" };
  const profileVisibility = () => form.querySelector('input[name="profileVisibility"]:checked')?.value || "cohort";

  function allowedVisibility(kind, profile) {
    if (profile === "hidden") return ["hidden"];
    if (kind === "email" || kind === "phone" || profile === "cohort") return ["cohort", "hidden"];
    return ["public", "cohort", "hidden"];
  }

  function updatePrivacyControls(useDefaults) {
    const profile = profileVisibility();
    const defaults = {
      public: { photo: "public", linkedin: "public", instagram: "hidden", email: "hidden", phone: "hidden" },
      cohort: { photo: "cohort", linkedin: "cohort", instagram: "hidden", email: "hidden", phone: "hidden" },
      hidden: { photo: "hidden", linkedin: "hidden", instagram: "hidden", email: "hidden", phone: "hidden" }
    }[profile];

    ["photo", "linkedin", "instagram", "email", "phone"].forEach((kind) => {
      const select = $(`${kind}Visibility`);
      if (!select) return;
      const wanted = useDefaults ? defaults[kind] : (select.value || defaults[kind]);
      const options = allowedVisibility(kind, profile);
      select.replaceChildren(...options.map((value) => new Option(VIS_LABEL[value], value)));
      select.value = options.includes(wanted) ? wanted : options[options.length - 1];
    });
    updatePrivacySummary();
  }

  function updatePrivacySummary() {
    const profile = profileVisibility();
    const title = document.createElement("strong");
    title.textContent = `Current profile setting: ${VIS_LABEL[profile]}`;
    const text = document.createElement("span");
    text.textContent = {
      public: " After you confirm your email and the profile is reviewed, only the fields you set to Public may appear on the public Student Hub.",
      cohort: " Your profile will not be published. It stays private until a secure login for EU-HEM students exists.",
      hidden: " Your individual profile will not be displayed anywhere."
    }[profile] + " Nothing is published automatically.";
    $("privacySummary").replaceChildren(title, text);
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

  function buildPayload() {
    const value = (id) => ($(id) ? $(id).value.trim() : "");
    const checked = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || "";
    return {
      requestId,
      elapsedMs: Math.round(performance.now() - openedAt),
      website: value("website"),
      consentVersion: config.consentVersion || "",
      fullName: value("fullName"),
      universityEmail: value("universityEmail").toLowerCase(),
      primaryCountry: value("primaryCountry"),
      previousField: value("previousField"),
      previousFieldOther: value("previousFieldOther"),
      euhemTrack: value("euhemTrack"),
      additionalCountry: value("additionalCountry"),
      previousDegree: value("previousDegree"),
      previousUniversity: value("previousUniversity"),
      shortBio: value("shortBio"),
      professionalInterests: value("professionalInterests"),
      researchInterests: value("researchInterests"),
      languages: value("languages"),
      hobbies: value("hobbies"),
      canHelpWith: value("canHelpWith"),
      connectAbout: value("connectAbout"),
      linkedin: value("linkedin"),
      instagram: value("instagram"),
      phone: collectPhone ? value("phone") : "",
      profileVisibility: checked("profileVisibility"),
      photoVisibility: value("photoVisibility"),
      emailVisibility: value("emailVisibility"),
      linkedinVisibility: value("linkedinVisibility"),
      instagramVisibility: value("instagramVisibility"),
      phoneVisibility: collectPhone ? value("phoneVisibility") : "hidden",
      analyticsConsent: checked("analyticsConsent"),
      privacyAcknowledgement: $("privacyAcknowledgement").checked ? "yes" : "",
      photoBase64: photo ? photo.base64 : "",
      photoMimeType: photo ? photo.type : ""
    };
  }

  function setSubmitting(on) {
    submitting = on;
    $("submitButton").disabled = on;
    $("submitSpinner").hidden = !on;
    $("submitButtonText").textContent = on ? "Submitting…" : "Submit profile";
  }

  function showMessage(text) {
    messageBox.textContent = text;
    if (text) messageBox.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
  }

  function showSuccess(result) {
    const profile = profileVisibility();
    $("successConfirmText").textContent = {
      sent: `We sent a confirmation link to ${$("universityEmail").value.trim()}. Open it to confirm the address is yours. Check your spam folder if it does not arrive.`,
      failed: "We could not send the confirmation email, so the Student Hub team will verify your address manually.",
      not_required: "Your submission is waiting for review."
    }[result.confirmation] || "Your submission is waiting for review.";
    $("successVisibilityText").textContent = {
      public: "After review, only the information you set to Public may be added to the public directory.",
      cohort: "Your profile stays private for now. It can later appear only to verified EU-HEM students, once a secure login exists.",
      hidden: "Your profile has been saved but will not be displayed."
    }[profile];
    form.hidden = true;
    document.querySelector(".progress-card").hidden = true;
    clearPhoto();
    form.reset();
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
      showMessage("The directory is not open for submissions yet. Please come back soon.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await send(buildPayload());
      if (result && result.ok) { showSuccess(result); return; }
      showMessage(result && result.code === "DUPLICATE_EMAIL"
        ? "A profile already exists for this university email. To update or delete it, please contact the Student Hub team."
        : (result && result.message) || "We could not submit your profile. Please try again.");
    } catch (error) {
      showMessage(error.name === "AbortError"
        ? "The submission took too long. Please check your connection and press Submit again. Your profile will not be saved twice."
        : "We could not reach the server. Please check your connection and press Submit again. Your profile will not be saved twice.");
    } finally {
      setSubmitting(false);
    }
  });

  /* ---------- start ---------- */

  $("countryList").replaceChildren(...countries.map((country) => new Option("", country)));
  if (!collectPhone) document.querySelectorAll("[data-phone-field]").forEach((el) => el.remove());
  if (allowedDomains.length) {
    $("universityEmailHelp").textContent =
      `Use your ${allowedDomains.map((d) => `@${d}`).join(" or ")} address. We send one email to confirm it is yours. It is never shown publicly.`;
  }
  updatePrivacyControls(true);
  setStep(1, { focus: false });
})();
