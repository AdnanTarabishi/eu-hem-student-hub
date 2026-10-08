/* Copy the public inbox on request. The ordinary email links also work without
   JavaScript; the separately configured form below is an optional direct route. */
(function () {
  if (typeof document === "undefined") return;
  const address = document.getElementById("contact-email");
  const copyButton = document.getElementById("contact-copy-email");
  const status = document.getElementById("contact-copy-status");
  const fallback = document.getElementById("contact-copy-fallback");
  const copyValue = document.getElementById("contact-copy-value");
  if (!address || !copyButton || !status || !fallback || !copyValue) return;

  const email = address.textContent.trim();
  let copying = false;
  copyValue.value = email;
  copyButton.hidden = false;

  copyButton.addEventListener("click", async () => {
    if (copying) return;
    copying = true;
    copyButton.setAttribute("aria-busy", "true");
    status.textContent = "";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(email);
      fallback.hidden = true;
      status.textContent = "Email address copied.";
    } catch {
      fallback.hidden = false;
      status.textContent = "Automatic copying is unavailable. Select the address below and copy it.";
      copyValue.focus();
      copyValue.select();
      copyValue.setSelectionRange(0, email.length);
    } finally {
      copying = false;
      copyButton.removeAttribute("aria-busy");
    }
  });
})();

/* Direct contact: configuration-gated, no browser storage, no automatic sends.
   A successful HTTP response alone is not a receipt. The server must acknowledge
   this exact request and notice version before the form can show success. */
(function () {
  if (typeof document === "undefined") return;
  const form = document.getElementById("contact-form");
  const formFields = document.getElementById("contact-form-fields");
  if (!form || !formFields) return;
  // Attach before enabling anything: even a later initialization error cannot
  // turn the form into an accidental navigation or a native GET submission.
  let submitHandler = null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submitHandler) submitHandler();
  });
  const config = window.CONTACT_CONFIG;
  if (!window.ContactConfig?.isConfigured(config)) return;

  const topics = {
    correction: { title: "Report a correction", label: "What needs changing?", help: "Tell us where you noticed the problem and what should happen instead.", fields: ["pageUrl", "sourceUrl"] },
    idea: { title: "Share your idea", label: "How would your idea help?", help: "Describe what you’re trying to do and how the Hub could make it easier.", fields: [] },
    privacy: { title: "Your privacy request", label: "What would you like us to do?", help: "Include only the details needed to identify the item or request. You do not need to send identity documents.", fields: ["requestType", "pageUrl"] },
    contribution: { title: "Offer a contribution", label: "Tell us about your contribution", help: "Explain what you created, where it could fit, and any permission details. A submission is for review, not automatic publication.", fields: ["resourceUrl", "preferredCredit"] },
  };
  const fields = Object.fromEntries([...form.querySelectorAll("[data-contact-field]")].map((input) => [input.dataset.contactField, input]));
  const radios = [...form.querySelectorAll("input[name='topic']")];
  for (const radio of radios) radio.id = `contact-topic-${radio.value}`;
  const extraFields = ["requestType", "pageUrl", "sourceUrl", "resourceUrl", "preferredCredit"];
  const errors = document.getElementById("contact-errors");
  const status = document.getElementById("contact-send-status");
  const success = document.getElementById("contact-success");
  const submit = document.getElementById("contact-submit");
  const drafts = new Map();
  const attempts = new Map();
  let activeTopic = "";
  let sending = false;
  let uncertainKey = "";

  function countMessage() {
    document.getElementById("contact-message-count").textContent = `${fields.message.value.length.toLocaleString("en-GB")} / 5,000`;
  }

  function clearErrors() {
    errors.hidden = true;
    errors.querySelector("ul").replaceChildren();
    for (const input of [...Object.values(fields), ...radios]) input.removeAttribute("aria-invalid");
    for (const message of form.querySelectorAll(".contact-field-error")) {
      message.hidden = true;
      message.textContent = "";
    }
  }

  function showErrors(fieldErrors) {
    clearErrors();
    const list = errors.querySelector("ul");
    for (const [key, text] of Object.entries(fieldErrors)) {
      const input = key === "topic" ? radios[0] : fields[key];
      const inline = document.getElementById(`contact-error-${key}`);
      if (!input || !inline || input.disabled || input.closest("[hidden]")) continue;
      inline.textContent = String(text).slice(0, 240);
      inline.hidden = false;
      for (const control of key === "topic" ? radios : [input]) control.setAttribute("aria-invalid", "true");
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${input.id}`;
      link.textContent = inline.textContent;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        input.focus({ preventScroll: true });
        input.scrollIntoView({ block: "center", behavior: "instant" });
      });
      item.appendChild(link);
      list.appendChild(item);
    }
    if (list.childElementCount) {
      errors.hidden = false;
      errors.focus();
      return true;
    }
    return false;
  }

  function selectTopic(topic) {
    const unassignedMessage = activeTopic ? "" : fields.message.value;
    if (activeTopic) drafts.set(activeTopic, Object.fromEntries(["message", ...extraFields].map((key) => [key, fields[key].value])));
    activeTopic = topics[topic] ? topic : "";
    const draft = drafts.get(activeTopic) || {};
    for (const key of ["message", ...extraFields]) fields[key].value = draft[key] || "";
    if (!draft.message && unassignedMessage) fields.message.value = unassignedMessage;
    for (const group of form.querySelectorAll(".contact-conditional")) {
      const visible = group.dataset.contactTopics.split(" ").includes(activeTopic);
      group.hidden = !visible;
      group.disabled = !visible;
    }
    const topicInfo = topics[activeTopic];
    document.getElementById("contact-writing-title").textContent = topicInfo?.title || "Your message";
    document.getElementById("contact-writing-help").textContent = topicInfo?.help || "Choose the topic that best fits, then tell us how we can help.";
    document.getElementById("contact-message-label").textContent = topicInfo?.label || "Your message";
    clearErrors();
    countMessage();
  }

  function validUrl(value) {
    if (/[\s\\\u0000-\u001f\u007f]/u.test(value)) return false;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }

  function collect() {
    const values = { noticeVersion: config.noticeVersion, topic: activeTopic };
    for (const key of ["name", "email", "message", ...(topics[activeTopic]?.fields || [])]) values[key] = fields[key].value.trim();
    values.website = document.getElementById("contact-website").value.trim().slice(0, 200);
    return values;
  }

  function validate(values) {
    const problems = {};
    if (!topics[values.topic]) problems.topic = "Choose a topic for your message.";
    if (values.name.length > 80) problems.name = "Keep your name to 80 characters or fewer.";
    if (values.email.length > 254 || (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) problems.email = "Enter a valid reply email, or leave it empty.";
    if (values.message.length < 10 || values.message.length > 5000) problems.message = "Write a message between 10 and 5,000 characters.";
    for (const key of ["pageUrl", "sourceUrl", "resourceUrl"]) {
      if (values[key] && (values[key].length > 2048 || !validUrl(values[key]))) {
        const label = { pageUrl: "page link", sourceUrl: "source link", resourceUrl: "resource link" }[key];
        problems[key] = `Enter an http:// or https:// ${label} without a username or password, or leave it empty.`;
      }
    }
    if (values.topic === "privacy" && !["question", "access", "correction", "removal", "other"].includes(values.requestType)) problems.requestType = "Choose the type of privacy request.";
    if (values.preferredCredit?.length > 120) problems.preferredCredit = "Keep the preferred credit to 120 characters or fewer.";
    return problems;
  }

  function requestId() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function showStatus(message, kind = "error", focus = true) {
    status.textContent = message;
    status.dataset.state = kind;
    if (focus) status.focus();
  }

  function updateUncertainNotice() {
    if (!uncertainKey || sending) return;
    const changed = JSON.stringify(collect()) !== uncertainKey;
    const message = changed
      ? "Your earlier message may already have arrived. Sending this edited message creates a separate submission. Your text is still here."
      : "We couldn’t confirm receipt. Your message may have reached the Hub. Your text is still here; retry the same message to check it safely.";
    if (status.textContent !== message) showStatus(message, "uncertain", false);
  }

  function isReceipt(result, payload) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const receivedTime = typeof result?.receivedAt === "string" ? Date.parse(result.receivedAt) : NaN;
    return result?.ok === true && result.requestId === payload.requestId && result.noticeVersion === payload.noticeVersion &&
      typeof result.receiptId === "string" && uuid.test(result.receiptId) && Number.isFinite(receivedTime) &&
      new Date(receivedTime).toISOString() === result.receivedAt;
  }

  function received(result, payload) {
    uncertainKey = "";
    form.hidden = true;
    status.textContent = "";
    delete status.dataset.state;
    document.getElementById("contact-receipt").textContent = result.receiptId;
    document.getElementById("contact-received-at").textContent = new Date(result.receivedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) + " (your local time)";
    document.getElementById("contact-success-reply").textContent = payload.email ? "You included a reply email, so the team can contact you if a response or more details are needed." : "You did not include a reply email. Keep this reference if you contact the Hub about the message later.";
    success.hidden = false;
    success.focus();
  }

  function rejected(result) {
    if (result.code === "VALIDATION_ERROR" && result.fieldErrors && typeof result.fieldErrors === "object") {
      status.textContent = "";
      delete status.dataset.state;
      if (showErrors(result.fieldErrors)) return;
    }
    const messages = {
      INVALID_REQUEST: "The service could not accept this message. Your text is still here. Please check the details or use the email option below.",
      VALIDATION_ERROR: "Please check your message details and try again. Your text is still here.",
      NOTICE_CHANGED: "The privacy information has changed. Keep a copy of your message, then refresh this page before sending again.",
      REQUEST_CONFLICT: "This submission reference could not be reused. Your text is still here; contact the Hub by email to check receipt.",
      BUSY: "The service is busy. Your text is still here; please wait a moment and try again.",
      NOT_CONFIGURED: "Direct messages are temporarily unavailable. Your text is still here. You can use the email option below.",
      SAVE_FAILED: "The service could not confirm receipt. Your text is still here; retry the same message or use the email option below.",
      UNAVAILABLE: "The service is temporarily unavailable. Your text is still here; please try again later or use the email option below.",
    };
    showStatus(messages[result.code] || "The service could not confirm receipt. Your text is still here; retry the same message or use the email option below.");
  }

  submitHandler = async () => {
    if (sending) return;
    clearErrors();
    status.textContent = "";
    delete status.dataset.state;
    const values = collect();
    const problems = validate(values);
    if (Object.keys(problems).length) { showErrors(problems); updateUncertainNotice(); return; }
    if (navigator.onLine === false) {
      showStatus("You’re offline. This message has not been submitted. Your text is still here; reconnect before sending.");
      return;
    }
    const key = JSON.stringify(values);
    let attempt = attempts.get(key);
    if (!attempt) {
      try {
        const payload = { requestId: requestId(), ...values };
        attempt = { payload, body: JSON.stringify(payload) };
        attempts.set(key, attempt);
      } catch {
        showStatus("This browser could not prepare a secure submission reference. Your message has not been sent. You can use the email option below.");
        return;
      }
    }
    sending = true;
    formFields.disabled = true;
    form.setAttribute("aria-busy", "true");
    submit.textContent = "Sending…";
    showStatus("Sending your message…", "sending", false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(config.endpoint, {
        method: "POST", mode: "cors", redirect: "follow", credentials: "omit",
        cache: "no-store", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: attempt.body, signal: controller.signal,
      });
      const result = await response.json();
      if (response.ok && isReceipt(result, attempt.payload)) received(result, attempt.payload);
      else if (result?.ok === false && typeof result.code === "string") rejected(result);
      else throw new Error("Unconfirmed receipt");
    } catch {
      uncertainKey = key;
      showStatus("We couldn’t confirm receipt. Your message may have reached the Hub. Your text is still here; retry the same message to check it safely.", "uncertain");
    } finally {
      window.clearTimeout(timeout);
      sending = false;
      formFields.disabled = false;
      form.removeAttribute("aria-busy");
      submit.textContent = "Send to the Hub";
    }
  };

  for (const radio of radios) radio.addEventListener("change", () => { selectTopic(radio.value); updateUncertainNotice(); });
  form.addEventListener("input", updateUncertainNotice);
  form.addEventListener("change", updateUncertainNotice);
  fields.message.addEventListener("input", countMessage);
  document.getElementById("contact-new-message").addEventListener("click", () => {
    form.reset();
    drafts.clear();
    attempts.clear();
    uncertainKey = "";
    activeTopic = "";
    selectTopic("");
    status.textContent = "";
    success.hidden = true;
    form.hidden = false;
    formFields.disabled = false;
    radios[0].focus();
  });

  // Only the last initialization steps change the published fallback experience.
  // A configured URL is not evidence of delivery; only received() confirms that.
  selectTopic("");
  formFields.disabled = false;
  document.getElementById("contact-form-section").hidden = false;
  document.getElementById("contact-write-link").hidden = false;
  document.getElementById("contact-topics").hidden = true;
  document.getElementById("contact-process").hidden = false;
  document.getElementById("contact-email-destination").appendChild(document.querySelector(".contact-email-panel"));
  document.getElementById("contact-email-title").textContent = "Prefer to email us?";
  document.body.classList.add("contact-form-ready");
})();
