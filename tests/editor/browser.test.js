// Editor dashboard (admin.html) and the public Community events (calendar.html) in a real browser
// (installed Chrome), with a FAKE Supabase in memory: no network, no real project.
// The fake replaces vendor/supabase/supabase.js and supabase-config.js. It checks the screens and buttons;
// the real permission rules live in the database and are checked by tests/editor/schema.test.mjs.
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
    otp: [], rpc: [],
    db: {
      editors: [
        { user_id: "u-admin", email: "admin@example.org", display_name: "Student Hub team", role: "admin", created_at: "2026-10-01T10:00:00Z" },
        { user_id: "u-editor", email: "editor@example.org", display_name: "Rep team", role: "editor", created_at: "2026-10-02T10:00:00Z" },
      ],
      announcements: setup.announcements || [],
      events: setup.events || [],
      activity_log: setup.activity || [],
    },
  };
  let listener = null, seq = 0;
  function run(q) {
    let table = fake.db[q.table];
    const match = (row) => q.filters.every(([column, value]) => row[column] === value);
    if (q.action === "select") {
      let rows = table.filter(match).map((row) => ({ ...row }));
      if (q.limit) rows = rows.slice(0, q.limit);
      return { data: q.one ? rows[0] || null : rows, error: null };
    }
    if (q.action === "insert") {
      const row = { id: "new-" + (++seq), created_by: fake.session.user.id, created_at: new Date().toISOString(), review_note: null, ...q.payload };
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
    const q = { table, filters: [], action: "select", payload: null, one: false, limit: 0 };
    const b = {
      select() { return b; }, order() { return b; },
      limit(n) { q.limit = n; return b; },
      eq(column, value) { q.filters.push([column, value]); return b; },
      maybeSingle() { q.one = true; return b; }, single() { q.one = true; return b; },
      insert(payload) { q.action = "insert"; q.payload = payload; return b; },
      update(payload) { q.action = "update"; q.payload = payload; return b; },
      delete() { q.action = "delete"; return b; },
      then(resolve, reject) { return Promise.resolve(run(q)).then(resolve, reject); },
    };
    return b;
  }
  async function rpc(name, args) {
    fake.rpc.push({ name, args });
    if (name === "add_editor") {
      if (args.p_email === "nobody@example.org") return { data: null, error: { code: "P0002", message: "No account with this email yet. Create it first in Supabase: Authentication > Users > Add user." } };
      fake.db.editors.push({ user_id: "u-" + args.p_email, email: args.p_email, display_name: args.p_display_name, role: args.p_role, created_at: new Date().toISOString() });
    }
    if (name === "remove_editor") fake.db.editors = fake.db.editors.filter((m) => m.user_id !== args.p_user_id);
    return { data: null, error: null };
  }
  window.supabase = {
    createClient(url, key, options) {
      fake.created = { url, key, options };
      return {
        from, rpc,
        auth: {
          onAuthStateChange(callback) { listener = callback; setTimeout(() => callback("INITIAL_SESSION", fake.session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
          async signInWithOtp(args) { fake.otp.push(args); return { data: {}, error: null }; },
          async signOut() { fake.session = null; listener && listener("SIGNED_OUT", null); return { error: null }; },
        },
      };
    },
  };
})();`;

const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
const shift = (days) => { const d = new Date(today + "T12:00:00"); d.setDate(d.getDate() + days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ann = (over) => ({ id: "a" + Math.random().toString(36).slice(2), cohort: "2026-2028", date: today, title: "Example", category: "Student",
  message: "Hello", link: null, pinned: false, expires: null, posted_by: "Student Hub team", status: "published", created_by: "u-admin",
  created_at: "2026-10-07T08:00:00Z", review_note: null, ...over });
const evt = (over) => ({ id: "e" + Math.random().toString(36).slice(2), cohort: "2026-2028", title: "Aperitivo", category: "Social",
  starts_on: shift(5), start_time: "18:00:00", ends_on: null, end_time: null, location: "Piazza Verdi", description: "Meet the cohort.",
  link: null, posted_by: "Rep team", status: "published", created_by: "u-editor", created_at: "2026-10-07T08:00:00Z", review_note: null, ...over });

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

  async function open({ connected = true, who = null, announcements = [], events = [], activity = [], siteCsv = null, siteEvents = null,
    viewport = { width: 1280, height: 900 }, scheme = "light", hash = "" } = {}) {
    const context = await browser.newContext({ viewport, colorScheme: scheme });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|announcements/i.test(m.text())) errors.push(m.text()); });
    await page.addInitScript((s) => { window.__setup = s; }, { who, announcements, events, activity });
    await page.route("**/supabase-config.js*", (r) => r.fulfill({ contentType: "text/javascript", body: connected ? CONNECTED : NOT_CONNECTED }));
    await page.route("**/vendor/supabase/supabase.js*", (r) => r.fulfill({ contentType: "text/javascript", body: FAKE_SUPABASE }));
    if (siteCsv !== null) await page.route("**/data/announcements.csv*", (r) => r.fulfill({ contentType: "text/csv", body: siteCsv }));
    if (siteEvents !== null) await page.route("**/data/events.json*", (r) => r.fulfill({ contentType: "application/json", body: siteEvents }));
    await page.goto(base + "admin.html" + hash);
    return page;
  }
  const visible = (page, selector) => page.isVisible(selector);
  const text = (page, selector) => page.textContent(selector);
  const buttons = (page, selector) => page.$$eval(selector, (all) => all.map((b) => b.textContent));

  /* ----- Not connected, signing in ----- */
  let page = await open({ connected: false });
  await page.waitForSelector("#admin-offline:not([hidden])");
  assert.strictEqual(await page.getAttribute('meta[name="robots"]', "content"), "noindex, nofollow");
  ok("not connected: says so (and the page is hidden from search engines)");
  await page.context().close();

  page = await open();
  await page.waitForSelector("#admin-signin:not([hidden])");
  await page.fill("#admin-email", "not-an-email");
  await page.click("#admin-signin-form button[type=submit]");
  assert.match(await text(page, "#admin-status"), /valid email/);
  await page.fill("#admin-email", "editor@example.org");
  await page.click("#admin-signin-form button[type=submit]");
  await page.waitForFunction(() => window.__fake.otp.length === 1);
  const otp = await page.evaluate(() => window.__fake.otp[0]);
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

  /* ----- Editor: overview, announcements with preview, events ----- */
  page = await open({ who: "editor", announcements: [
    ann({ title: "Already public" }),
    ann({ id: "back", title: "Party poster", status: "draft", created_by: "u-editor", review_note: "Please add the time." }),
  ] });
  await page.waitForSelector("#panel-overview:not([hidden])");
  assert.deepStrictEqual(await buttons(page, ".admin-section-link"), ["Overview", "Announcements1", "Events", "Activity"]);
  await page.waitForSelector(".admin-todo");
  assert.match(await text(page, "#overview-todo"), /Party poster.*Sent back: Please add the time\./);
  assert.match(await text(page, "#overview-stats"), /1Your drafts/);
  ok("editor overview: no Team section; what was sent back (with the admin's note) is on top, with a badge");

  await page.click('.admin-section-link[data-section="announcements"]');
  await page.waitForSelector("#panel-announcements:not([hidden]) .admin-item");
  assert.strictEqual(await page.getAttribute('#panel-announcements .admin-tab[aria-selected="true"]', "data-status"), "draft");
  assert.match(await text(page, "#panel-announcements .admin-review-note"), /Note from the admin: Please add the time\./);
  await page.click('#panel-announcements .admin-tab[data-status="published"]');
  assert.deepStrictEqual(await buttons(page, "#panel-announcements .admin-item .admin-actions button"), ["Duplicate"], "an editor cannot change published items");

  await page.click('#panel-announcements [data-action="new"]');
  await page.waitForSelector("#announcements-dialog[open]");
  assert.ok(!(await visible(page, '#announcements-dialog [data-role="publish"]')), "editors have no Publish button");
  assert.strictEqual(await page.inputValue("#announcements-f-posted_by"), "Rep team");
  assert.strictEqual(await page.inputValue("#announcements-f-date"), today);
  await page.click('#announcements-dialog [data-role="submit-review"]');
  assert.ok(await visible(page, "#announcements-dialog .admin-errors"));
  assert.strictEqual(await page.getAttribute("#announcements-f-title", "aria-invalid"), "true");
  assert.strictEqual(await page.evaluate(() => document.activeElement.id), "announcements-f-title");
  await page.fill("#announcements-f-title", "Room change for Statistics");
  await page.fill("#announcements-f-message", "Room 3 instead of Room 1.\nSame time.");
  assert.strictEqual(await text(page, "#announcements-dialog .admin-preview .announcement-title"), "Room change for Statistics");
  assert.match(await text(page, "#announcements-dialog .admin-preview .announcement-message"), /Room 3 instead of Room 1\./);
  assert.match(await text(page, "#announcements-dialog .admin-counter"), /^26 \/ 120$/);
  await page.selectOption("#announcements-f-category", "Urgent");
  assert.ok(await visible(page, '#announcements-dialog [data-role="urgent-note"]'));
  assert.ok(await visible(page, "#announcements-dialog .admin-preview .urgent-banner"));
  await page.selectOption("#announcements-f-category", "Academic");
  assert.ok(!(await visible(page, '#announcements-dialog [data-role="urgent-note"]')));
  await page.click('#announcements-dialog [data-role="submit-review"]');
  await page.waitForSelector("#announcements-dialog", { state: "hidden" });
  await page.waitForSelector('#panel-announcements .admin-item h3:text-is("Room change for Statistics")');
  const saved = await page.evaluate(() => window.__fake.db.announcements.find((r) => r.title === "Room change for Statistics"));
  assert.strictEqual(saved.status, "submitted");
  assert.strictEqual(saved.cohort, "2026-2028");
  assert.strictEqual(saved.message, "Room 3 instead of Room 1.\nSame time.");
  assert.deepStrictEqual(await buttons(page, "#panel-announcements .admin-item .admin-actions button"), ["Edit", "Back to draft", "Duplicate"]);
  ok("editor announcements: live preview, counter and Urgent warning; sends for review; cannot publish");

  await page.fill("#announcements-search", "nothing like this");
  assert.match(await text(page, "#panel-announcements .admin-list"), /Nothing matches your search/);
  await page.fill("#announcements-search", "statistics");
  assert.strictEqual(await page.locator("#panel-announcements .admin-item").count(), 1);
  ok("search filters the list");

  await page.click('.admin-section-link[data-section="events"]');
  await page.waitForSelector("#panel-events:not([hidden])");
  await page.click('#panel-events [data-action="new"]');
  await page.waitForSelector("#events-dialog[open]");
  await page.fill("#events-f-title", "Cohort aperitivo");
  await page.fill("#events-f-starts_on", shift(3));
  await page.fill("#events-f-start_time", "19:00");
  await page.fill("#events-f-end_time", "18:00");
  await page.fill("#events-f-description", "Meet the cohort.");
  await page.fill("#events-f-location", "Piazza Verdi");
  assert.strictEqual(await text(page, "#events-dialog .admin-preview .event-title"), "Cohort aperitivo");
  assert.match(await text(page, "#events-dialog .admin-preview .event-location"), /Piazza Verdi/);
  await page.click('#events-dialog button[value="draft"]');
  assert.match(await text(page, "#events-dialog .admin-errors"), /end time is before the start time/);
  await page.fill("#events-f-end_time", "21:00");
  await page.click('#events-dialog button[value="draft"]');
  await page.waitForSelector("#events-dialog", { state: "hidden" });
  const event = await page.evaluate(() => window.__fake.db.events[0]);
  assert.deepStrictEqual([event.status, event.start_time, event.end_time, event.ends_on], ["draft", "19:00", "21:00", null]);
  ok("editor events: preview uses the public event card; impossible times are refused; saved as a draft");
  await page.context().close();

  /* ----- Admin: review, team, activity, sync check ----- */
  const evil = '<img src=x onerror="window.__pwned=1">';
  page = await open({
    who: "admin",
    announcements: [ann({ id: "s1", title: evil, status: "submitted", created_by: "u-editor", message: "<b>bold?</b>" }),
      ann({ id: "p1", title: "Welcome", status: "published" })],
    events: [evt({ id: "ev1", status: "submitted" })],
    activity: [{ id: 1, at: new Date().toISOString(), actor_email: "editor@example.org", item_table: "events", item_title: "Aperitivo", action: "sent for review" }],
    siteCsv: "Date,Title,Category,Message,Link,Pinned,Expires,Posted by\n" + today + ",Old one,Student,x,,,,Team\n",
    siteEvents: JSON.stringify({ schemaVersion: 1, events: [] }),
  });
  await page.waitForSelector(".admin-todo");
  assert.deepStrictEqual(await buttons(page, ".admin-section-link"), ["Overview", "Announcements1", "Events1", "Team", "Activity"]);
  assert.match(await text(page, "#overview-stats"), /2Waiting for review/);
  await page.waitForSelector(".admin-sync.is-pending");
  assert.match(await text(page, "#overview-sync"), /Announcements: 1 published not on the site yet, 1 still on the site but no longer published/);
  assert.match(await text(page, "#overview-activity"), /editor@example\.org sent for review/);
  ok("admin overview: review count and badges, site sync check, recent activity");

  await page.click('.admin-section-link[data-section="announcements"]');
  await page.waitForSelector('#panel-announcements .admin-tab[data-status="submitted"][aria-selected="true"]');
  assert.strictEqual(await text(page, "#panel-announcements .admin-item h3"), evil, "titles are shown as text, never run as HTML");
  assert.strictEqual(await page.evaluate(() => window.__pwned), undefined);
  assert.deepStrictEqual(await buttons(page, "#panel-announcements .admin-item .admin-actions button"), ["Edit", "Publish", "Send back…", "Duplicate", "Delete"]);
  await page.click('#panel-announcements .admin-item button:text-is("Send back…")');
  await page.waitForSelector("#admin-note-dialog[open]");
  await page.fill("#admin-note-text", "Please remove the HTML.");
  await page.click('#admin-note-dialog button[value="send"]');
  await page.waitForFunction(() => window.__fake.db.announcements[0].status === "draft");
  assert.strictEqual(await page.evaluate(() => window.__fake.db.announcements[0].review_note), "Please remove the HTML.");
  assert.match(await text(page, "#admin-status"), /Sent back to the editor with your note/);
  await page.click('#panel-announcements .admin-item button:text-is("Publish")');
  await page.waitForFunction(() => window.__fake.db.announcements[0].status === "published");
  assert.match(await text(page, "#admin-status"), /within about 15 minutes/);
  ok("admin: sends back with a note, publishes; text from editors is never treated as HTML");

  await page.click('.admin-section-link[data-section="team"]');
  await page.waitForSelector("#panel-team .admin-member");
  assert.strictEqual(await page.locator("#panel-team .admin-member").count(), 2);
  assert.ok(await page.isDisabled('#panel-team [data-user="u-admin"] button:text-is("Remove from team")'), "the last admin cannot be removed");
  await page.fill("#team-email", "nobody@example.org");
  await page.click('#team-add-form button[type="submit"]');
  await page.waitForFunction(() => /No account with this email yet/.test(document.getElementById("admin-status").textContent));
  await page.fill("#team-email", "new.rep@example.org");
  await page.fill("#team-display-name", "Class reps");
  await page.click('#team-add-form button[type="submit"]');
  await page.waitForSelector('#panel-team .admin-member:has-text("new.rep@example.org")');
  assert.deepStrictEqual(await page.evaluate(() => window.__fake.rpc.at(-1)),
    { name: "add_editor", args: { p_email: "new.rep@example.org", p_role: "editor", p_display_name: "Class reps" } });
  page.once("dialog", (d) => d.accept());
  await page.click('#panel-team [data-user="u-editor"] button:text-is("Remove from team")');
  await page.waitForFunction(() => window.__fake.db.editors.every((m) => m.user_id !== "u-editor"));
  ok("team: add (with a clear message for unknown emails), remove; the last admin is protected");

  await page.click('.admin-section-link[data-section="activity"]');
  await page.waitForSelector("#activity-list .admin-activity-item");
  assert.match(await text(page, "#activity-list"), /editor@example\.org sent for review Event “Aperitivo”/);
  assert.strictEqual(new URL(page.url()).hash, "#activity");
  await page.goBack();
  await page.waitForSelector("#panel-team:not([hidden])");
  ok("activity log; sections have their own address, so Back works");

  await page.click("#admin-signout");
  await page.waitForSelector("#admin-signin:not([hidden])");
  ok("sign out returns to the sign-in form");
  await page.context().close();

  /* ----- Phone, dark mode ----- */
  page = await open({ who: "admin", announcements: [ann({ title: "A very long title that should wrap nicely on a small phone screen without overflow" })],
    viewport: { width: 360, height: 740 }, scheme: "dark", hash: "#announcements" });
  await page.waitForSelector("#panel-announcements:not([hidden]) .admin-item");
  let sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sideways <= 0, `sideways scroll of ${sideways}px`);
  await page.click('#panel-announcements [data-action="new"]');
  await page.waitForSelector("#announcements-dialog[open]");
  sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(sideways <= 0, `sideways scroll of ${sideways}px with the form open`);
  assert.ok((await page.$eval("#announcements-dialog", (d) => d.getBoundingClientRect().width)) <= 360, "the form fits the phone");
  ok("phone (360 px, dark): no sideways scrolling; the form and preview fit");
  await page.context().close();

  /* ----- Public Calendar page: Community events ----- */
  const calendar = async (body) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    if (body !== null) await p.route("**/data/events.json*", (r) => r.fulfill({ contentType: "application/json", body }));
    await p.goto(base + "calendar.html");
    await p.waitForLoadState("networkidle");
    return p;
  };
  page = await calendar(null);
  assert.ok(await page.isHidden("#community-events"), "hidden while the dashboard is not connected");
  await page.context().close();
  page = await calendar(JSON.stringify({ schemaVersion: 1, events: [
    { id: "1", title: "Past party", category: "Social", startsOn: shift(-2), description: "x", postedBy: "Team" },
    { id: "2", title: "Ski weekend", category: "Sports", startsOn: shift(1), endsOn: shift(3), description: "Bring <b>gloves</b>", location: "Dolomites", postedBy: "Reps" },
    { id: "3", title: "Career talk", category: "Career", startsOn: shift(1), startTime: "09:00", description: "Alumni panel", link: "https://example.org", postedBy: "Team" },
  ] }));
  await page.waitForSelector("#community-events:not([hidden]) .event-card");
  assert.deepStrictEqual(await page.$$eval("#community-events .event-title", (all) => all.map((h) => h.textContent)), ["Ski weekend", "Career talk"]); // same day: all-day first, like calendar apps
  assert.match(await text(page, "#community-events"), /Bring <b>gloves<\/b>/, "event text stays text");
  assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
  ok("calendar page: Community events shows upcoming events only, soonest first (all-day before timed); hidden until the dashboard is connected");
  await page.context().close();

  assert.deepStrictEqual(errors, [], "no JavaScript errors");
  ok("no JavaScript errors");
  await browser.close();
  site.close();
  console.log(`${n} editor browser checks passed`);
})().catch((error) => { console.error(error); process.exit(1); });
