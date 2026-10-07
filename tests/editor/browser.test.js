// Editor dashboard (admin.html) in a real browser (installed Chrome), with a FAKE Supabase in memory:
// no network, no real project. The fake replaces vendor/supabase/supabase.js and supabase-config.js.
// It checks the screens and buttons; the real permission rules live in the database (supabase/schema.sql)
// and are checked by tests/editor/data.test.js and the setup test in docs/editor-dashboard.md.
// Run: node tests/editor/browser.test.js .
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("playwright");
const ROOT = path.resolve(process.argv[2] || ".");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".csv": "text/csv" };

const CONNECTED = 'window.EUHEM_SUPABASE = { url: "https://fake.supabase.co", publishableKey: "sb_publishable_test", cohort: "2026-2028" };';
const NOT_CONNECTED = 'window.EUHEM_SUPABASE = { url: "", publishableKey: "", cohort: "2026-2028" };';

// The fake Supabase library. Test setup arrives in window.__setup (who is signed in, which rows exist).
const FAKE_SUPABASE = `
(function () {
  const setup = window.__setup || {};
  const users = { admin: { id: "u-admin", email: "admin@example.org" }, editor: { id: "u-editor", email: "editor@example.org" }, stranger: { id: "u-x", email: "x@example.org" } };
  const fake = window.__fake = {
    session: setup.who ? { user: users[setup.who] } : null,
    otp: [],
    db: {
      editors: [
        { user_id: "u-admin", email: "admin@example.org", display_name: "Student Hub team", role: "admin" },
        { user_id: "u-editor", email: "editor@example.org", display_name: "Rep team", role: "editor" },
      ],
      announcements: setup.rows || [],
    },
  };
  let listener = null, seq = 0;
  function run(q) {
    const table = fake.db[q.table];
    const match = (row) => q.filters.every(([column, value]) => row[column] === value);
    if (q.action === "select") {
      const rows = table.filter(match).map((row) => ({ ...row }));
      return { data: q.one ? rows[0] || null : rows, error: null };
    }
    if (q.action === "insert") {
      const row = { id: "new-" + (++seq), created_by: fake.session.user.id, created_at: new Date().toISOString(), ...q.payload };
      table.push(row);
      return { data: { ...row }, error: null };
    }
    if (q.action === "update") {
      const rows = table.filter(match);
      rows.forEach((row) => Object.assign(row, q.payload));
      return { data: rows[0] ? { ...rows[0] } : null, error: null };
    }
    if (q.action === "delete") {
      fake.db[q.table] = table.filter((row) => !match(row));
      return { data: null, error: null };
    }
  }
  function from(table) {
    const q = { table, filters: [], action: "select", payload: null, one: false };
    const b = {
      select() { return b; }, order() { return b; },
      eq(column, value) { q.filters.push([column, value]); return b; },
      maybeSingle() { q.one = true; return b; }, single() { q.one = true; return b; },
      insert(payload) { q.action = "insert"; q.payload = payload; return b; },
      update(payload) { q.action = "update"; q.payload = payload; return b; },
      delete() { q.action = "delete"; return b; },
      then(resolve, reject) { return Promise.resolve(run(q)).then(resolve, reject); },
    };
    return b;
  }
  window.supabase = {
    createClient(url, key, options) {
      fake.created = { url, key, options };
      return {
        from,
        auth: {
          onAuthStateChange(callback) { listener = callback; setTimeout(() => callback("INITIAL_SESSION", fake.session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithOtp(args) { fake.otp.push(args); return { data: {}, error: null }; },
          async signOut() { fake.session = null; listener && listener("SIGNED_OUT", null); return { error: null }; },
        },
      };
    },
  };
})();`;

const row = (over) => ({ id: "r" + Math.random().toString(36).slice(2), cohort: "2026-2028", date: "2026-10-07", title: "Example", category: "Student",
  message: "Hello", link: null, pinned: false, expires: null, posted_by: "Student Hub team", status: "published", created_by: "u-admin",
  created_at: "2026-10-07T08:00:00Z", ...over });

(async () => {
  const site = http.createServer((req, res) => {
    const file = decodeURIComponent(req.url.split("?")[0].replace(/^\//, "")) || "index.html";
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); return res.end("missing"); }
    res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "text/plain" }); res.end(fs.readFileSync(full));
  }).listen(0);
  const base = `http://127.0.0.1:${site.address().port}/`;
  const browser = await chromium.launch({ channel: "chrome" });
  let n = 0; const ok = (name) => { n++; console.log("  ok  " + name); };
  const errors = [];

  async function open({ connected = true, who = null, rows = [], viewport = { width: 1280, height: 900 }, scheme = "light" } = {}) {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|announcements/i.test(m.text())) errors.push(m.text()); });
    await page.addInitScript((s) => { window.__setup = s; }, { who, rows });
    await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: connected ? CONNECTED : NOT_CONNECTED }));
    await page.route("**/vendor/supabase/supabase.js*", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_SUPABASE }));
    await page.goto(base + "admin.html");
    return page;
  }
  const visible = (page, selector) => page.isVisible(selector);
  const text = (page, selector) => page.textContent(selector);

  /* ----- Not connected yet ----- */
  let page = await open({ connected: false });
  await page.waitForSelector("#admin-offline:not([hidden])");
  assert.ok(!(await visible(page, "#admin-signin")));
  assert.strictEqual(await page.getAttribute('meta[name="robots"]', "content"), "noindex, nofollow");
  ok("not connected: says so (and the page is hidden from search engines)");
  await page.context().close();

  /* ----- Signing in ----- */
  page = await open();
  await page.waitForSelector("#admin-signin:not([hidden])");
  await page.fill("#admin-email", "not-an-email");
  await page.click("#admin-signin-form button[type=submit]");
  assert.match(await text(page, "#admin-status"), /valid email/);
  await page.fill("#admin-email", "editor@example.org");
  await page.click("#admin-signin-form button[type=submit]");
  await page.waitForFunction(() => window.__fake.otp.length === 1);
  const otp = await page.evaluate(() => window.__fake.otp[0]);
  assert.strictEqual(otp.email, "editor@example.org");
  assert.strictEqual(otp.options.shouldCreateUser, false);
  assert.match(otp.options.emailRedirectTo, /\/admin\.html$/);
  assert.match(await text(page, "#admin-status"), /If this email is on the editor list/);
  ok("sign in: checks the address, sends a link without creating accounts, and does not reveal who is an editor");
  await page.context().close();

  page = await open({ who: "stranger" });
  await page.waitForSelector("#admin-not-editor:not([hidden])");
  assert.ok(!(await visible(page, "#admin-app")));
  ok("signed in but not an editor: no dashboard, only how to ask for access");
  await page.context().close();

  /* ----- Editor ----- */
  page = await open({ who: "editor", rows: [row({ title: "Already public" })] });
  await page.waitForSelector("#admin-app:not([hidden])");
  assert.match(await text(page, "#admin-who"), /editor@example\.org · Editor/);
  assert.strictEqual(await page.getAttribute('.admin-tab[aria-selected="true"]', "data-status"), "draft");
  await page.click('.admin-tab[data-status="published"]');
  await page.waitForSelector('.admin-item h3:text-is("Already public")');
  assert.strictEqual(await page.locator(".admin-item .admin-actions button").count(), 0, "an editor cannot touch published items");

  await page.click("#admin-new");
  await page.waitForSelector("#admin-dialog[open]");
  assert.ok(!(await visible(page, "#admin-publish")), "editors have no Publish button");
  assert.strictEqual(await page.inputValue("#f-posted-by"), "Rep team");
  await page.click("#admin-submit-review");
  assert.ok(await visible(page, "#admin-form-errors"));
  assert.strictEqual(await page.getAttribute("#f-title", "aria-invalid"), "true");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "f-title");
  await page.fill("#f-title", "Study group on Thursday");
  await page.fill("#f-message", "Library, room 2, 17:00.\nBring your notes.");
  await page.selectOption("#f-category", "Student");
  await page.click("#admin-submit-review");
  await page.waitForSelector("#admin-dialog", { state: "hidden" });
  await page.waitForSelector('.admin-item h3:text-is("Study group on Thursday")');
  assert.strictEqual(await page.getAttribute('.admin-tab[aria-selected="true"]', "data-status"), "submitted");
  const saved = await page.evaluate(() => window.__fake.db.announcements.find((r) => r.title === "Study group on Thursday"));
  assert.strictEqual(saved.status, "submitted");
  assert.strictEqual(saved.cohort, "2026-2028");
  assert.strictEqual(saved.message, "Library, room 2, 17:00.\nBring your notes.");
  assert.deepStrictEqual(await page.$$eval(".admin-item .admin-actions button", (all) => all.map((b) => b.textContent)), ["Edit", "Back to draft"]);
  ok("editor: writes and sends for review, cannot publish or change published items; form errors are marked and focused");
  await page.context().close();

  /* ----- Admin ----- */
  const evil = '<img src=x onerror="window.__pwned=1">';
  page = await open({ who: "admin", rows: [row({ id: "s1", title: evil, status: "submitted", created_by: "u-editor", message: "<b>bold?</b>" })] });
  await page.waitForSelector("#admin-app:not([hidden])");
  assert.strictEqual(await page.getAttribute('.admin-tab[aria-selected="true"]', "data-status"), "submitted");
  assert.strictEqual(await text(page, ".admin-item h3"), evil, "titles are shown as text, never run as HTML");
  assert.strictEqual(await page.evaluate(() => window.__pwned), undefined);
  assert.deepStrictEqual(await page.$$eval(".admin-item .admin-actions button", (all) => all.map((b) => b.textContent)),
    ["Edit", "Publish", "Send back to draft", "Delete"]);
  await page.click('.admin-item button:text-is("Publish")');
  await page.waitForFunction(() => window.__fake.db.announcements[0].status === "published");
  await page.waitForSelector('.admin-tab[data-status="published"][aria-selected="true"]');
  assert.match(await text(page, "#admin-status"), /within about 15 minutes/);
  await page.click("#admin-new");
  assert.ok(await visible(page, "#admin-publish"));
  assert.ok(!(await visible(page, "#admin-submit-review")));
  await page.click("#admin-cancel");
  ok("admin: reviews and publishes; text from editors is never treated as HTML");

  await page.click("#admin-signout");
  await page.waitForSelector("#admin-signin:not([hidden])");
  assert.ok(!(await visible(page, "#admin-account")));
  ok("sign out returns to the sign-in form");
  await page.context().close();

  /* ----- Phone, dark mode ----- */
  page = await open({ who: "admin", rows: [row({ title: "A very long title that should wrap nicely on a small phone screen without overflow" })], viewport: { width: 360, height: 740 }, scheme: "dark" });
  await page.waitForSelector("#admin-app:not([hidden])");
  await page.click('.admin-tab[data-status="published"]');
  await page.click("#admin-new");
  await page.waitForSelector("#admin-dialog[open]");
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sideways <= 0, `sideways scroll of ${sideways}px`);
  const dialog = await page.$eval("#admin-dialog", (d) => d.getBoundingClientRect().width);
  assert.ok(dialog <= 360, "the form fits the phone");
  ok("phone (360 px, dark): no sideways scrolling; the form fits");
  await page.context().close();

  assert.deepStrictEqual(errors, [], "no JavaScript errors");
  ok("no JavaScript errors");
  await browser.close();
  site.close();
  console.log(`${n} editor browser checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
