"use strict";
// Fictional data and mocked transport only. This file never calls a live endpoint.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "../..");
const SOURCE = fs.readFileSync(path.join(ROOT, "experiences-submit.js"), "utf8");
const CONFIG_SOURCE = fs.readFileSync(path.join(ROOT, "contact-config.js"), "utf8");
const RECEIVER_SOURCE = fs.readFileSync(path.join(ROOT, "integrations/contact-apps-script/Code.gs"), "utf8");
const ENDPOINT = "https://script.google.com/macros/s/fictional-experience-test/exec";
const VERSION = "contact-v1-2026-10";
const RECEIPT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const RECEIVED_AT = "2026-10-10T12:00:00.000Z";
const DATA = {
  cities: { bologna: { name: "Bologna" }, oslo: { name: "Oslo" }, innsbruck: { name: "Innsbruck" }, rotterdam: { name: "Rotterdam" } },
  topics: { study: "Study & workload", housing: "Housing & daily life", costs: "Costs & budgeting" },
  tracks: { ep: "Economics & Policy" },
};
function fixture(overrides = {}) {
  const input = {
    data: {
      stage: "Current student", scope: "City or semester experience", formTrack: "Economics & Policy",
      cohort: "2026–2028", background: "Economics", period: "Autumn 2026",
      title: "A fictional study experience", story: "Prepare your study notes early and check the official course resources.",
      tip1: "Make a simple plan for the first week.", tip2: "", tip3: "", surprise: "", different: "",
      detail_study: "A fictional detail about preparing a study group.",
      nameMode: "anonymous", displayName: "", audience: "unpublished", showCohort: "no", showBackground: "no",
      replyEmail: "", reviewConsent: "on", website: "",
    },
    journey: { bologna: "in_progress", oslo: "planned", innsbruck: "", rotterdam: "" },
    topics: ["study"],
  };
  return { ...input, ...overrides, data: { ...input.data, ...(overrides.data || {}) } };
}
function receipt(request, overrides = {}) {
  return { ok: true, requestId: request.requestId, receiptId: RECEIPT_ID, receivedAt: RECEIVED_AT, noticeVersion: VERSION, ...overrides };
}
function response(body, overrides = {}) {
  return { ok: true, type: "cors", json: async () => body, ...overrides };
}
function harness({ fetcher, configured = true, online = true, secure = true } = {}) {
  const calls = [];
  const timers = new Map();
  const navigator = { onLine: online };
  let timerId = 0;
  const window = {
    navigator, crypto: secure ? { randomUUID: () => crypto.randomUUID() } : {},
    setTimeout(callback, milliseconds) { assert.equal(milliseconds, 20000); timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      assert.equal(url, ENDPOINT, "all requests must use the fictional endpoint");
      calls.push({ url, options, payload: JSON.parse(options.body) });
      return fetcher ? fetcher(calls.at(-1), calls.length) : response(receipt(calls.at(-1).payload));
    },
    localStorage: { getItem() { assert.fail("Adapter must not read persisted drafts"); }, setItem() { assert.fail("Adapter must not persist answers"); } },
    sessionStorage: { getItem() { assert.fail("Adapter must not read stored attempts"); }, setItem() { assert.fail("Adapter must not queue requests"); } },
  };
  const context = vm.createContext({ window, AbortController, URL, Uint8Array });
  vm.runInContext(CONFIG_SOURCE, context);
  window.CONTACT_CONFIG = { endpoint: configured ? ENDPOINT : "", noticeVersion: VERSION };
  window.EUHEM_EXPERIENCES = DATA;
  vm.runInContext(SOURCE, context);
  return { api: window.ExperienceSubmission, window, navigator, calls, timers, context, expire() { for (const callback of timers.values()) callback(); } };
}

test("startup and count/validation checks do not send, store or ping anything", () => {
  const h = harness();
  assert.equal(h.api.isConfigured(), true);
  assert.ok(h.api.buildMessage(...Object.values(fixture()), DATA).length);
  assert.equal(Object.keys(h.api.validate(fixture().data, fixture().journey, fixture().topics, DATA)).length, 0);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.size, 0);
});

test("the complete message preserves selected answers, metadata and separately labelled plans", () => {
  const h = harness();
  const input = fixture({ data: { tip2: "Second fictional tip.", tip3: "Third fictional tip.", surprise: "A fictional surprise.", different: "A fictional alternative.", detail_costs: "City: Bologna; period: autumn 2026; monthly food estimate only.", detail_housing: "Unselected private draft text.", audience: "public" }, topics: ["costs", "study"] });
  const message = h.api.buildMessage(input.data, input.journey, input.topics, DATA);
  for (const key of ["stage", "scope", "formTrack", "cohort", "background", "period", "title", "story", "tip1", "tip2", "tip3", "surprise", "different", "detail_study", "detail_costs"]) assert.ok(message.includes(input.data[key]), key);
  assert.match(message, /Lived journey: Bologna — in progress/);
  assert.match(message, /Plans only: Oslo — planned, not lived experience/);
  assert.doesNotMatch(message, /Unselected private draft text/);
  assert.match(message, /Consider for a public story after review and author approval/);
  assert.match(message, /Show cohort in a future story: No/);
  assert.match(message, /Show previous field in a future story: No/);
});

test("anonymous identity is omitted; first-name mode sends only the first name", async () => {
  const h = harness();
  await h.api.send(fixture({ data: { displayName: "Fictional Example Student" } }), DATA);
  assert.equal(h.calls[0].payload.name, "");
  assert.equal(h.calls[0].payload.preferredCredit, "Do not publish my name");
  assert.doesNotMatch(h.calls[0].payload.message, /Fictional Example Student/);
  await h.api.send(fixture({ data: { nameMode: "first", displayName: "Fictional Example Student" } }), DATA);
  assert.equal(h.calls[1].payload.name, "Fictional");
  assert.match(h.calls[1].payload.message, /Suggested display name: Fictional/);
  assert.doesNotMatch(h.calls[1].payload.message, /Example Student/);
});

test("a matching receipt confirms only private storage with the existing contribution protocol", async () => {
  const h = harness();
  const result = await h.api.send(fixture({ data: { replyEmail: "fictional@example.test" } }), DATA);
  assert.equal(result.ok, true);
  assert.equal(result.state, "received");
  assert.equal(result.receipt.receiptId, RECEIPT_ID);
  assert.equal(result.receipt.receivedAt, RECEIVED_AT);
  assert.equal(result.receipt.requestId, h.calls[0].payload.requestId);
  assert.match(result.message, /not publication or a reply/);
  const { payload, options } = h.calls[0];
  assert.deepEqual(Object.keys(payload).sort(), ["requestId", "noticeVersion", "topic", "message", "name", "email", "website", "resourceUrl", "preferredCredit"].sort());
  assert.equal(payload.topic, "contribution");
  assert.equal(payload.email, "fictional@example.test");
  assert.equal(payload.noticeVersion, VERSION);
  assert.equal(options.method, "POST");
  assert.equal(options.mode, "cors");
  assert.equal(options.redirect, "follow");
  assert.equal(options.credentials, "omit");
  assert.equal(options.referrerPolicy, "no-referrer");
  assert.equal(options.cache, "no-store");
  assert.equal(options.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.equal(h.timers.size, 0);

  // Execute the receiver's actual pure validator locally, without Google services.
  const backend = vm.createContext({});
  vm.runInContext(RECEIVER_SOURCE, backend);
  const normalised = backend.validateContact_(payload);
  assert.equal(normalised.message, payload.message);
  assert.equal(normalised.topic, "contribution");
});

test("malformed acknowledgements never become a confirmed receipt", async (t) => {
  const variants = [
    ["wrong request", (p) => receipt(p, { requestId: crypto.randomUUID() })],
    ["wrong notice", (p) => receipt(p, { noticeVersion: "other-notice" })],
    ["malformed receipt reference", (p) => receipt(p, { receiptId: "saved" })],
    ["missing timestamp", (p) => receipt(p, { receivedAt: undefined })],
    ["noncanonical timestamp", (p) => receipt(p, { receivedAt: "2026-10-10T12:00:00Z" })],
    ["impossible date", (p) => receipt(p, { receivedAt: "2026-02-30T12:00:00.000Z" })],
    ["nonboolean success", (p) => receipt(p, { ok: "true" })],
    ["unexpected response field", (p) => receipt(p, { answers: "must not echo answers" })],
    ["empty response", () => null],
  ];
  for (const [name, create] of variants) await t.test(name, async () => {
    const h = harness({ fetcher: ({ payload }) => response(create(payload)) });
    const result = await h.api.send(fixture(), DATA);
    assert.equal(result.ok, false);
    assert.equal(result.state, "uncertain");
    assert.equal(result.receipt, undefined);
    assert.match(result.message, /may already have reached/);
  });
});

test("network loss retries the exact same request body and receipt reference", async () => {
  const h = harness({ fetcher: ({ payload }, count) => count === 1 ? Promise.reject(new Error("Lost response")) : response(receipt(payload)) });
  assert.equal((await h.api.send(fixture(), DATA)).state, "uncertain");
  assert.match(h.api.getWarning(fixture(), DATA), /unchanged answers/);
  const recovered = await h.api.send(fixture(), DATA);
  assert.equal(recovered.state, "received");
  assert.equal(h.calls[1].options.body, h.calls[0].options.body);
  assert.equal(h.api.getWarning(fixture(), DATA), "");
  const alreadyReceived = await h.api.send(fixture(), DATA);
  assert.equal(alreadyReceived.receipt.requestId, recovered.receipt.requestId);
  assert.equal(h.calls.length, 2, "confirmed unchanged answers must not create another POST");
});

test("edited uncertain answers warn about duplication and use a separate identifier", async () => {
  const h = harness({ fetcher: ({ payload }, count) => count === 1 ? Promise.reject(new Error("Lost response")) : response(receipt(payload)) });
  await h.api.send(fixture(), DATA);
  const edited = fixture({ data: { title: "An edited fictional experience" } });
  assert.match(h.api.getWarning(edited, DATA), /separate submission and may duplicate/);
  const result = await h.api.send(edited, DATA);
  assert.equal(result.state, "received");
  assert.notEqual(h.calls[0].payload.requestId, h.calls[1].payload.requestId);
  assert.match(result.message, /earlier different submission still has no confirmed receipt/);
  await h.api.send(fixture(), DATA);
  assert.equal(h.calls[0].payload.requestId, h.calls[2].payload.requestId);
  assert.equal(h.api.getWarning(edited, DATA), "");
});

test("normalised whitespace and topic ordering reuse an unchanged submission", async () => {
  const h = harness({ fetcher: () => Promise.reject(new Error("Lost response")) });
  await h.api.send(fixture({ topics: ["study", "costs"], data: { detail_costs: "A fictional estimate.\r\nContext applies." } }), DATA);
  await h.api.send(fixture({ topics: ["costs", "study"], data: { title: "  A fictional study experience  ", detail_costs: "A fictional estimate.\nContext applies." } }), DATA);
  assert.equal(h.calls[0].options.body, h.calls[1].options.body);
});

test("offline checks never POST and preserve uncertainty from an earlier attempt", async () => {
  const h = harness({ online: false, fetcher: () => Promise.reject(new Error("Lost response")) });
  const before = await h.api.send(fixture(), DATA);
  assert.equal(before.state, "offline");
  assert.equal(before.uncertain, false);
  assert.equal(h.calls.length, 0);
  h.navigator.onLine = true;
  await h.api.send(fixture(), DATA);
  h.navigator.onLine = false;
  const retry = await h.api.send(fixture(), DATA);
  assert.equal(retry.state, "offline");
  assert.equal(retry.uncertain, true);
  assert.match(retry.message, /No new request was sent/);
  assert.match(retry.message, /may already have reached/);
  const edited = await h.api.send(fixture({ data: { title: "Edited while offline" } }), DATA);
  assert.match(edited.message, /separate submission/);
  assert.equal(h.calls.length, 1);
});

test("a timeout aborts the request and releases the sending state for an exact retry", async () => {
  const h = harness({ fetcher: () => new Promise(() => {}) });
  const pending = h.api.send(fixture(), DATA);
  assert.equal(h.calls.length, 1);
  assert.equal((await h.api.send(fixture(), DATA)).state, "busy");
  assert.equal(h.calls.length, 1);
  h.expire();
  assert.equal((await pending).state, "uncertain");
  assert.equal(h.calls[0].options.signal.aborted, true);
  assert.equal(h.timers.size, 0);
  const retry = h.api.send(fixture(), DATA);
  h.expire();
  assert.equal((await retry).state, "uncertain");
  assert.equal(h.calls[0].options.body, h.calls[1].options.body);
});

test("unknown, failed storage, non-success HTTP and non-JSON responses stay uncertain", async (t) => {
  const cases = [
    ["post-write failure", () => response({ ok: false, code: "SAVE_FAILED" })],
    ["unknown failure", () => response({ ok: false, code: "OTHER" })],
    ["HTTP 500", ({ payload }) => response(receipt(payload), { ok: false })],
    ["opaque response", ({ payload }) => response(receipt(payload), { type: "opaque" })],
    ["malformed JSON", () => response(null, { json: async () => { throw new Error("Malformed JSON"); } })],
  ];
  for (const [name, fetcher] of cases) await t.test(name, async () => {
    const h = harness({ fetcher });
    assert.equal((await h.api.send(fixture(), DATA)).state, "uncertain");
  });
});

test("known rejections keep the answers and never expose echoed server text", async () => {
  const h = harness({ fetcher: () => response({ ok: false, code: "VALIDATION_ERROR", fieldErrors: { email: "Fictional private reply email must not be echoed", unknown: "Unknown server text" } }) });
  const result = await h.api.send(fixture(), DATA);
  assert.equal(result.state, "rejected");
  assert.equal(result.code, "VALIDATION_ERROR");
  assert.equal(result.fieldErrors.replyEmail, "Enter a valid reply email, or leave it empty.");
  assert.equal(result.fieldErrors.unknown, undefined);
  assert.doesNotMatch(JSON.stringify(result), /Fictional private reply email|Unknown server text/);
});

test("a later known rejection does not erase uncertainty about an earlier lost response", async () => {
  const h = harness({ fetcher: (_call, count) => count === 1 ? Promise.reject(new Error("Lost response")) : response({ ok: false, code: "BUSY" }) });
  await h.api.send(fixture(), DATA);
  const result = await h.api.send(fixture(), DATA);
  assert.equal(result.state, "rejected");
  assert.match(result.message, /may already have reached/);
  assert.match(h.api.getWarning(fixture(), DATA), /unchanged answers/);
});

test("overlong aggregate answers are rejected intact before any request", async () => {
  const h = harness();
  const input = fixture({ data: { story: "s".repeat(1800), tip1: "a".repeat(500), tip2: "b".repeat(500), tip3: "c".repeat(500), surprise: "d".repeat(700), different: "e".repeat(700), detail_study: "f".repeat(1000), detail_housing: "g".repeat(1000), detail_costs: "h".repeat(1000) }, topics: ["study", "housing", "costs"] });
  const fullMessage = h.api.buildMessage(input.data, input.journey, input.topics, DATA);
  assert.ok(fullMessage.length > 5000);
  assert.ok(fullMessage.includes("h".repeat(1000)));
  const result = await h.api.send(input, DATA);
  assert.equal(result.state, "validation");
  assert.ok(result.fieldErrors.message.includes(fullMessage.length.toLocaleString("en-GB")));
  assert.ok(result.fieldErrors.message.includes((fullMessage.length - 5000).toLocaleString("en-GB")));
  assert.match(result.fieldErrors.message, /No answers have been removed/);
  assert.equal(h.calls.length, 0);
});

test("strict form validation rejects empty, unsupported and invalid fields before POST", async (t) => {
  const cases = [
    ["whitespace story", fixture({ data: { story: "   " } }), "story"],
    ["short first tip", fixture({ data: { tip1: "Short" } }), "tip1"],
    ["missing title", fixture({ data: { title: " " } }), "title"],
    ["invalid stage", fixture({ data: { stage: "Visitor" } }), "stage"],
    ["unsupported member audience", fixture({ data: { audience: "members" } }), "audience"],
    ["missing display identity", fixture({ data: { nameMode: "full", displayName: " " } }), "displayName"],
    ["malformed reply email", fixture({ data: { replyEmail: "not-an-email" } }), "replyEmail"],
    ["unconfirmed review permission", fixture({ data: { reviewConsent: "" } }), "reviewConsent"],
    ["filled honeypot", fixture({ data: { website: "https://example.test" } }), "website"],
    ["no topics", fixture({ topics: [] }), "topics"],
    ["unknown topic", fixture({ topics: ["unknown"] }), "topics"],
    ["duplicate topic", fixture({ topics: ["study", "study"] }), "topics"],
    ["planned cities only", fixture({ journey: { bologna: "planned", oslo: "", innsbruck: "", rotterdam: "" } }), "journey"],
    ["unknown journey city", fixture({ journey: { bologna: "completed", unknown: "completed" } }), "journey"],
    ["invalid journey status", fixture({ journey: { bologna: "visited" } }), "journey"],
    ["invalid answer type", fixture({ data: { title: { value: "Bad type" } } }), "title"],
    ["control character", fixture({ data: { title: "A fictional\u0000 title" } }), "title"],
    ["oversized selected detail", fixture({ data: { detail_study: "z".repeat(1001) } }), "detail_study"],
  ];
  for (const [name, input, field] of cases) await t.test(name, async () => {
    const h = harness();
    const result = await h.api.send(input, DATA);
    assert.equal(result.state, "validation");
    assert.ok(result.fieldErrors[field], field);
    assert.equal(h.calls.length, 0);
  });
});

test("an absent optional second tip is accepted, and unselected topic drafts are omitted", async () => {
  const h = harness();
  const result = await h.api.send(fixture({ data: { detail_housing: "x".repeat(5000) } }), DATA);
  assert.equal(result.state, "received");
  assert.doesNotMatch(h.calls[0].payload.message, /x{100}/);
});

test("configuration and secure-reference failures cannot initiate any request", async (t) => {
  const cases = [
    ["empty configuration", { configured: false }, null],
    ["wrong notice", {}, { endpoint: ENDPOINT, noticeVersion: "new-version" }],
    ["alternate host", {}, { endpoint: "https://example.test/exec", noticeVersion: VERSION }],
    ["query parameters", {}, { endpoint: ENDPOINT + "?query=value", noticeVersion: VERSION }],
    ["secure randomness unavailable", { secure: false }, null],
  ];
  for (const [name, options, config] of cases) await t.test(name, async () => {
    const h = harness(options);
    if (config) h.window.CONTACT_CONFIG = config;
    const result = await h.api.send(fixture(), DATA);
    assert.equal(result.state, "unavailable");
    assert.equal(h.calls.length, 0);
  });
});

test("the secure random-byte fallback still creates a valid receiver-compatible UUID", async () => {
  const h = harness();
  h.window.crypto = { getRandomValues: (bytes) => crypto.randomFillSync(bytes) };
  assert.equal((await h.api.send(fixture(), DATA)).state, "received");
  assert.match(h.calls[0].payload.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
