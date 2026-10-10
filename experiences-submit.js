/* Student Experiences uses the established private Contact contribution inbox.
   This adapter sends only on an explicit call, keeps retry references in memory,
   and never writes drafts, queues requests or contacts the receiver on startup. */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const MAX_MESSAGE = 5000;
  const NOTICE_VERSION = "contact-v1-2026-10";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const attempts = new Map();
  const unconfirmed = new Set();
  let sending = false;

  const text = (value) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
  const own = (object, key) => Boolean(object && Object.hasOwn(object, key));
  const object = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
  const catalogue = (data) => data || window.EUHEM_EXPERIENCES || { cities: {}, topics: {}, tracks: {} };

  function isConfigured() {
    const config = window.CONTACT_CONFIG;
    return Boolean(config?.noticeVersion === NOTICE_VERSION && window.ContactConfig?.isConfigured(config));
  }

  function publicName(data) {
    if (data.nameMode === "anonymous") return "";
    const value = text(data.displayName);
    return data.nameMode === "first" ? value.split(/\s+/)[0] : value;
  }

  function buildMessage(data = {}, journey = {}, topics = [], suppliedData) {
    const DATA = catalogue(suppliedData);
    const lines = ["Student Experiences — contribution for private review", ""];
    function add(label, value) { if (text(value)) lines.push(label + ": " + text(value)); }
    add("Connection to EU-HEM", data.stage);
    add("Experience scope", data.scope);
    add("Track (review context)", data.formTrack);
    add("Cohort (review context)", data.cohort);
    add("Previous field (review context)", data.background);
    add("Experience period", data.period);

    const lived = [];
    const planned = [];
    for (const [city, info] of Object.entries(DATA.cities || {})) {
      const label = typeof info === "string" ? info : info.name;
      if (journey[city] === "completed") lived.push(label + " — completed");
      if (journey[city] === "in_progress") lived.push(label + " — in progress");
      if (journey[city] === "planned") planned.push(label + " — planned, not lived experience");
    }
    if (lived.length) lines.push("Lived journey: " + lived.join("; "));
    if (planned.length) lines.push("Plans only: " + planned.join("; "));
    lines.push("");
    add("Title", data.title);
    add("Main experience", data.story);
    ["tip1", "tip2", "tip3"].forEach((key, index) => add("Practical tip " + (index + 1), data[key]));
    add("What surprised me", data.surprise);
    add("What I would do differently", data.different);

    const selected = new Set(Array.isArray(topics) ? topics : []);
    const chosen = Object.keys(DATA.topics || {}).filter((key) => selected.has(key));
    if (chosen.length) {
      lines.push("", "Topics: " + chosen.map((key) => DATA.topics[key]).join("; "));
      chosen.forEach((key) => add(DATA.topics[key], data["detail_" + key]));
    }

    lines.push("", "Suggested display preferences (review only; no automatic publication)");
    const nameLabels = { anonymous: "Do not show my name", first: "First name only", full: "Full name", display: "Display name / pseudonym" };
    add("Name preference", nameLabels[data.nameMode]);
    add("Suggested display name", publicName(data));
    lines.push("Audience preference: " + (data.audience === "public" ? "Consider for a public story after review and author approval" : "Keep unpublished"));
    lines.push("Show cohort in a future story: " + (data.showCohort === "yes" ? "Yes" : "No"));
    lines.push("Show previous field in a future story: " + (data.showBackground === "yes" ? "Yes" : "No"));
    lines.push("Review permission: Contributor agreed to send these answers to the private Hub inbox under the Contact privacy notice. Publication requires separate review and author approval.");
    return lines.join("\n");
  }

  function validate(data, journey, topics, suppliedData) {
    const DATA = catalogue(suppliedData);
    const errors = {};
    if (!object(data) || !object(journey) || !Array.isArray(topics)) {
      return { message: "The experience details could not be prepared. Review the form before sending." };
    }
    function field(key, label, maximum, minimum = 0) {
      const raw = data[key];
      const value = text(raw);
      if (raw !== undefined && typeof raw !== "string") errors[key] = "Enter text for " + label + ".";
      else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) errors[key] = "Remove unsupported control characters from " + label + ".";
      else if (value.length < minimum) errors[key] = "Enter " + label + (minimum > 1 ? " with at least " + minimum + " characters." : ".");
      else if (value.length > maximum) errors[key] = "Keep " + label + " to " + maximum.toLocaleString("en-GB") + " characters or fewer.";
      return value;
    }
    function choice(key, allowed, message) {
      if (!allowed.includes(data[key])) errors[key] = message;
    }
    choice("stage", ["Current student", "Graduate / alumnus", "Former student"], "Choose your connection to EU-HEM.");
    choice("scope", ["City or semester experience", "EU-HEM journey so far", "Specific topic"], "Choose the kind of experience you are sharing.");
    field("formTrack", "the track", 120);
    field("cohort", "the cohort", 20);
    field("background", "your previous field", 80);
    field("period", "the experience period", 80);
    field("title", "a useful title", 100, 1);
    field("story", "your main experience", 1800, 30);
    field("tip1", "your first practical tip", 500, 10);
    field("tip2", "your second practical tip", 500);
    field("tip3", "your third practical tip", 500);
    field("surprise", "what surprised you", 700);
    field("different", "what you would do differently", 700);

    const cityIds = Object.keys(DATA.cities || {});
    if (!cityIds.length || Object.keys(journey).some((city) => !own(DATA.cities, city)) ||
        cityIds.some((city) => !["", "completed", "in_progress", "planned"].includes(journey[city] ?? ""))) {
      errors.journey = "Choose a valid status for each city in your journey.";
    } else if (!cityIds.some((city) => ["completed", "in_progress"].includes(journey[city]))) {
      errors.journey = "Mark at least one city as Completed or In progress. Planned cities do not count as lived experience.";
    }
    if (!topics.length || topics.some((topic) => typeof topic !== "string" || !own(DATA.topics, topic)) || new Set(topics).size !== topics.length) {
      errors.topics = "Choose at least one valid topic you can help another student with.";
    } else {
      topics.forEach((topic) => field("detail_" + topic, "the detail for " + DATA.topics[topic], 1000));
    }

    choice("nameMode", ["anonymous", "first", "full", "display"], "Choose how you would like your name to appear.");
    field("displayName", "the display name", 80, data.nameMode === "anonymous" ? 0 : 1);
    choice("audience", ["unpublished", "public"], "Choose Keep unpublished or Consider for public publication.");
    choice("showCohort", ["no", "yes"], "Choose whether a future story may show your cohort.");
    choice("showBackground", ["no", "yes"], "Choose whether a future story may show your previous field.");
    const email = field("replyEmail", "your reply email", 254);
    if (email && !/^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/.test(email)) errors.replyEmail = "Enter a valid reply email, or leave it empty.";
    if (![true, "on", "yes"].includes(data.reviewConsent)) errors.reviewConsent = "Confirm that you agree to send your answers for private review under the privacy notice.";
    if (data.website !== undefined && (typeof data.website !== "string" || text(data.website))) errors.website = "This request could not be accepted. Keep your draft and contact the Hub by email.";

    const message = buildMessage(data, journey, topics, DATA);
    if (message.length > MAX_MESSAGE) {
      errors.message = "Your combined submission has " + message.length.toLocaleString("en-GB") + " characters. Shorten it by at least " + (message.length - MAX_MESSAGE).toLocaleString("en-GB") + " characters to fit the 5,000-character private inbox limit. No answers have been removed.";
    }
    return errors;
  }

  function valuesFor({ data, journey, topics }, suppliedData) {
    const name = publicName(data);
    return {
      noticeVersion: NOTICE_VERSION,
      topic: "contribution",
      message: buildMessage(data, journey, topics, suppliedData),
      name,
      email: text(data.replyEmail),
      website: text(data.website),
      resourceUrl: "",
      preferredCredit: data.nameMode === "anonymous" ? "Do not publish my name" : name,
    };
  }

  function keyFor(input, DATA) {
    return JSON.stringify([window.CONTACT_CONFIG?.endpoint || "", valuesFor(input, DATA)]);
  }

  function getWarning(input, DATA) {
    if (!unconfirmed.size) return "";
    const unchanged = unconfirmed.has(keyFor(input, DATA));
    return unchanged
      ? "Your earlier submission may already have reached the Hub. Retry these unchanged answers to recover their receipt safely."
      : "Your earlier submission may already have reached the Hub. Sending these edited answers creates a separate submission and may duplicate the earlier one.";
  }

  function requestId() {
    if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
    if (typeof window.crypto?.getRandomValues !== "function") throw new Error("Secure reference unavailable");
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }

  function isReceipt(result, payload) {
    if (!object(result) || Object.keys(result).some((key) => !["ok", "requestId", "receiptId", "receivedAt", "noticeVersion"].includes(key))) return false;
    const time = typeof result.receivedAt === "string" ? Date.parse(result.receivedAt) : NaN;
    return result.ok === true && result.requestId === payload.requestId && UUID.test(result.requestId) &&
      result.noticeVersion === payload.noticeVersion && typeof result.receiptId === "string" && UUID.test(result.receiptId) &&
      Number.isFinite(time) && new Date(time).toISOString() === result.receivedAt;
  }

  const rejectionMessages = {
    INVALID_REQUEST: "The service could not accept these answers. Keep your draft and check the details or contact the Hub by email.",
    VALIDATION_ERROR: "The service could not accept some details. Check your answers and try again; your draft is still here.",
    NOTICE_CHANGED: "The privacy notice has changed. Keep a copy of your draft, then refresh this page before sending again.",
    REQUEST_CONFLICT: "This submission reference could not be reused. Keep your draft and contact the Hub by email to check receipt.",
    BUSY: "The service is busy. Your draft is still here; wait a moment and try again.",
    NOT_CONFIGURED: "Private review is temporarily unavailable. Your draft is still here; you can contact the Hub by email.",
    UNAVAILABLE: "The service is temporarily unavailable. Your draft is still here; try again later or contact the Hub by email.",
  };

  async function send(input, suppliedData) {
    if (sending) return { ok: false, state: "busy", message: "A submission is already being sent. Wait for its result before trying again." };
    const fieldErrors = validate(input?.data, input?.journey, input?.topics, suppliedData);
    if (Object.keys(fieldErrors).length) {
      const warning = input && object(input.data) && object(input.journey) && Array.isArray(input.topics) ? getWarning(input, suppliedData) : "";
      return { ok: false, state: "validation", fieldErrors, message: "Check the highlighted answers before sending." + (warning ? " " + warning : "") };
    }
    const warning = getWarning(input, suppliedData);
    if (!isConfigured()) return { ok: false, state: "unavailable", message: "Private review is unavailable. No new request was sent. Your draft is still here; you can contact the Hub by email." + (warning ? " " + warning : "") };
    if (window.navigator?.onLine === false) {
      return { ok: false, state: "offline", uncertain: Boolean(warning), message: "You’re offline. No new request was sent. Your draft is still here; reconnect before sending." + (warning ? " " + warning : "") };
    }
    const key = keyFor(input, suppliedData);
    const endpoint = window.CONTACT_CONFIG.endpoint;
    let attempt = attempts.get(key);
    if (attempt?.receipt) {
      return { ok: true, state: "received", receipt: { ...attempt.receipt }, message: "These unchanged answers were already received for private review. This reference confirms storage, not publication or a reply." };
    }
    if (!attempt) {
      try {
        const payload = { requestId: requestId(), ...valuesFor(input, suppliedData) };
        if (!UUID.test(payload.requestId)) throw new Error("Invalid secure reference");
        attempt = { payload, body: JSON.stringify(payload) };
        if (attempt.body.length > 20000) return { ok: false, state: "validation", fieldErrors: { message: "The prepared request is too large. Shorten your answers before sending; no answers have been removed." }, message: "Shorten your answers before sending." };
        attempts.set(key, attempt);
      } catch {
        return { ok: false, state: "unavailable", message: "This browser could not prepare a secure submission reference. No new request was sent. Keep your draft or contact the Hub by email." + (warning ? " " + warning : "") };
      }
    }
    let controller;
    try { controller = new AbortController(); }
    catch { return { ok: false, state: "unavailable", message: "This browser cannot send safely. No new request was sent. Keep your draft or contact the Hub by email." }; }
    sending = true;
    let timer;
    try {
      const deadline = new Promise((_, reject) => {
        timer = window.setTimeout(() => { controller.abort(); reject(new Error("Receipt timeout")); }, 20000);
      });
      const delivery = (async () => {
        const response = await window.fetch(endpoint, {
          method: "POST", mode: "cors", redirect: "follow", credentials: "omit",
          cache: "no-store", referrerPolicy: "no-referrer",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: attempt.body, signal: controller.signal,
        });
        if (!response.ok || response.type === "opaque") throw new Error("Unconfirmed response");
        return response.json();
      })();
      const result = await Promise.race([delivery, deadline]);
      if (isReceipt(result, attempt.payload)) {
        unconfirmed.delete(key);
        attempt.receipt = { receiptId: result.receiptId, receivedAt: result.receivedAt, requestId: result.requestId, noticeVersion: result.noticeVersion };
        const earlier = unconfirmed.size ? " An earlier different submission still has no confirmed receipt and may also have arrived." : "";
        return { ok: true, state: "received", receipt: { ...attempt.receipt }, message: "Your answers were received for private review. This reference confirms storage, not publication or a reply." + earlier };
      }
      if (object(result) && result.ok === false && typeof result.code === "string" && own(rejectionMessages, result.code)) {
        const fieldErrors = {};
        if (result.code === "VALIDATION_ERROR" && object(result.fieldErrors)) {
          // Use fixed messages: never display untrusted response text or echoed answers.
          const messages = {
            message: ["message", "Check the combined answer length; the private inbox accepts 10 to 5,000 characters."],
            name: ["displayName", "Keep the display name to 80 characters or fewer."],
            email: ["replyEmail", "Enter a valid reply email, or leave it empty."],
            preferredCredit: ["displayName", "Keep the suggested display name to 80 characters or fewer."],
          };
          for (const field of Object.keys(result.fieldErrors)) {
            if (own(messages, field)) fieldErrors[messages[field][0]] = messages[field][1];
          }
        }
        const stillUnconfirmed = getWarning(input, suppliedData);
        return { ok: false, state: "rejected", code: result.code, fieldErrors, message: rejectionMessages[result.code] + (stillUnconfirmed ? " " + stillUnconfirmed : "") };
      }
      throw new Error("Unconfirmed receipt");
    } catch {
      unconfirmed.add(key);
      return { ok: false, state: "uncertain", message: "We couldn’t confirm receipt. Your answers may already have reached the Hub. Your draft is still here; retry these unchanged answers to recover their receipt safely." };
    } finally {
      window.clearTimeout(timer);
      sending = false;
    }
  }

  window.ExperienceSubmission = Object.freeze({ isConfigured, buildMessage, validate, getWarning, send });
})();
