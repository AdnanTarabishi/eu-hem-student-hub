// The database rules in supabase/schema.sql, tested on a real PostgreSQL engine (PGlite: PostgreSQL compiled to
// WebAssembly, a development-only tool) with a small imitation of Supabase: the roles anon and authenticated,
// an auth.users table, and auth.uid() (who is signed in) read from a setting.
// It tries allowed and forbidden actions as a visitor, two editors and an admin, and checks the activity log.
// Run: node tests/editor/schema.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const db = new PGlite();
const ADMIN = "00000000-0000-0000-0000-0000000000a1";
const ED = "00000000-0000-0000-0000-0000000000e1";
const ED2 = "00000000-0000-0000-0000-0000000000e2";
const STRANGER = "00000000-0000-0000-0000-0000000000f1";

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('${ADMIN}','admin@x.org'),('${ED}','editor@x.org'),('${ED2}','editor2@x.org'),('${STRANGER}','new@x.org');
`);
const schema = fs.readFileSync(path.join(repo, "supabase/schema.sql"), "utf8");
await db.exec(schema);
await db.exec(schema); // running it twice must be safe
await db.exec(`insert into public.editors (user_id,email,display_name,role) values
  ('${ADMIN}','admin@x.org','Student Hub team','admin'), ('${ED}','editor@x.org','Reps','editor'), ('${ED2}','editor2@x.org','Reps 2','editor');`);

let n = 0, failed = 0;
async function as(who, sql) {
  const uid = { admin: ADMIN, editor: ED, editor2: ED2, stranger: STRANGER }[who] || "";
  const role = who === "anon" ? "anon" : who === "sql" ? null : "authenticated";
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  if (role) await db.exec(`set role ${role};`);
  try {
    if (who === "sql") { await db.exec(sql); return { rows: [] }; }
    const r = await db.query(sql);
    return { rows: r.rows, affected: r.affectedRows };
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec("reset role;");
  }
}
function check(name, cond, detail) {
  n++;
  if (cond) console.log("  ok  " + name);
  else { failed++; console.log("  FAIL " + name + "  " + JSON.stringify(detail)); }
}
const insertA = (status) =>
  `insert into public.announcements (title, category, message, posted_by, status) values ('T ${status}', 'Student', 'm', 'Team', '${status}') returning id, created_by, status`;

// --- announcements ---
let r = await as("anon", insertA("draft"));
check("anon cannot write", !!r.error, r);
r = await as("editor", insertA("published"));
check("editor cannot create published", !!r.error, r);
r = await as("editor", `insert into public.announcements (title,category,message,posted_by,status,created_by,review_note) values ('Mine','Student','m','Reps','draft','${ADMIN}','sneaky') returning id, created_by, review_note`);
check("editor creates a draft; created_by forced to self; review_note ignored", !r.error && r.rows[0].created_by === ED && r.rows[0].review_note === null, r);
const mine = r.rows[0].id;
r = await as("editor", `update public.announcements set status='published' where id='${mine}'`);
check("editor cannot publish own draft", !!r.error || r.affected === 0, r);
r = await as("editor", `update public.announcements set status='submitted' where id='${mine}'`);
check("editor submits own draft", !r.error && r.affected === 1, r);
r = await as("editor2", `update public.announcements set title='hacked' where id='${mine}'`);
check("another editor cannot change it", !r.error && r.affected === 0, r);
r = await as("editor2", `delete from public.announcements where id='${mine}'`);
check("another editor cannot delete it", !r.error && r.affected === 0, r);
r = await as("anon", `select * from public.announcements`);
check("anon sees no unpublished items", !r.error && r.rows.length === 0, r);
r = await as("admin", `update public.announcements set status='draft', review_note='Please add the room number.' where id='${mine}'`);
check("admin sends back with a note", !r.error && r.affected === 1, r);
r = await as("editor", `update public.announcements set review_note=null, title='Mine v2' where id='${mine}' returning review_note`);
check("editor edits but cannot erase the admin's note", !r.error && r.rows[0].review_note === "Please add the room number.", r);
r = await as("admin", `update public.announcements set status='published' where id='${mine}' returning reviewed_by, review_note`);
check("admin publishes: reviewed_by recorded, note cleared", !r.error && r.rows[0].reviewed_by === ADMIN && r.rows[0].review_note === null, r);
r = await as("anon", `select title from public.announcements`);
check("anon now sees the published item", !r.error && r.rows.length === 1, r);
r = await as("editor", `update public.announcements set title='after publish' where id='${mine}'`);
check("editor cannot edit a published item", !r.error && r.affected === 0, r);
r = await as("admin", `update public.announcements set reviewed_by='${ED}', created_by='${ED2}' where id='${mine}' returning reviewed_by, created_by`);
check("bookkeeping cannot be faked, even by an admin", !r.error && r.rows[0].reviewed_by === ADMIN && r.rows[0].created_by === ED, r);
r = await as("editor", `insert into public.announcements (title,category,message,posted_by) values ('xyz','Gossip','m','Reps')`);
check("database refuses unknown category", !!r.error, r);
r = await as("editor", `insert into public.announcements (title,category,message,posted_by,link) values ('xyz','Student','m','Reps','javascript:alert(1)')`);
check("database refuses non-web links", !!r.error, r);
r = await as("editor", insertA("draft"));
const d2 = r.rows[0].id;
r = await as("editor", `delete from public.announcements where id='${d2}'`);
check("editor deletes own draft", !r.error && r.affected === 1, r);

// --- edit conflicts: the dashboard only updates a row whose updated_at it has seen ---
r = await as("admin", `select updated_at::text as u from public.announcements where id='${mine}'`);
const seen = r.rows[0].u;
r = await as("admin", `update public.announcements set title='First admin' where id='${mine}' and updated_at='${seen}'`);
check("edit conflicts: an update with the latest updated_at goes through", !r.error && r.affected === 1, r);
r = await as("admin", `update public.announcements set title='Second admin' where id='${mine}' and updated_at='${seen}'`);
check("edit conflicts: a second update with the old updated_at changes nothing", !r.error && r.affected === 0, r);

// --- events ---
r = await as("editor", `insert into public.events (title,category,starts_on,ends_on,description,posted_by) values ('Trip','Social','2026-11-02','2026-11-01','d','Reps')`);
check("events: end before start refused", !!r.error, r);
r = await as("editor", `insert into public.events (title,category,starts_on,start_time,end_time,description,posted_by) values ('Trip','Social','2026-11-02','18:00','17:00','d','Reps')`);
check("events: end time before start time (same day) refused", !!r.error, r);
r = await as("editor", `insert into public.events (title,category,starts_on,start_time,end_time,description,posted_by,status) values ('Aperitivo','Social','2026-11-02','18:00','20:00','d','Reps','submitted') returning id`);
check("events: editor submits an event", !r.error, r);
const ev = r.rows && r.rows[0].id;
r = await as("anon", `select * from public.events`);
check("events: anon sees none before publishing", !r.error && r.rows.length === 0, r);
r = await as("admin", `update public.events set status='published' where id='${ev}'`);
check("events: admin publishes", !r.error && r.affected === 1, r);
r = await as("anon", `select title from public.events`);
check("events: anon sees the published event", !r.error && r.rows.length === 1, r);

// --- editors, team functions, activity log ---
r = await as("editor", `select email from public.editors`);
check("editor sees only own team row", !r.error && r.rows.length === 1 && r.rows[0].email === "editor@x.org", r);
r = await as("admin", `select email from public.editors`);
check("admin sees the whole team", !r.error && r.rows.length === 3, r);
r = await as("editor", `insert into public.editors (user_id,email,role) values ('${STRANGER}','new@x.org','admin')`);
check("nobody writes editors directly", !!r.error, r);
r = await as("admin", `insert into public.editors (user_id,email,role) values ('${STRANGER}','new@x.org','admin')`);
check("not even an admin (only via functions)", !!r.error, r);
r = await as("editor", `select public.add_editor('new@x.org','admin','x')`);
check("editor cannot add team members", !!r.error && /Only admins/.test(r.error), r);
r = await as("anon", `select public.add_editor('new@x.org','admin','x')`);
check("anon cannot call team functions", !!r.error, r);
r = await as("admin", `select public.add_editor('nobody@x.org','editor','x')`);
check("unknown email explained", !!r.error && /No account/.test(r.error), r);
r = await as("admin", `select public.add_editor(' NEW@x.org ','editor','New person')`);
check("admin adds an editor (email case/spaces ignored)", !r.error, r);
r = await as("admin", `select public.add_editor('new@x.org','editor','again')`);
check("adding twice explained", !!r.error && /already/.test(r.error), r);
r = await as("admin", `select public.update_editor('${ADMIN}','editor','Me')`);
check("the last admin cannot be demoted", !!r.error && /at least one admin/.test(r.error), r);
r = await as("admin", `select public.remove_editor('${ADMIN}')`);
check("the last admin cannot be removed", !!r.error && /at least one admin/.test(r.error), r);
r = await as("admin", `select public.update_editor('${STRANGER}','admin','New person')`);
check("admin promotes", !r.error, r);
r = await as("admin", `select public.remove_editor('${STRANGER}')`);
check("admin removes", !r.error, r);
r = await as("editor", `insert into public.activity_log (item_table, action) values ('x','fake')`);
check("nobody writes the log", !!r.error, r);
r = await as("anon", `select * from public.activity_log`);
check("anon cannot read the log", !!r.error || r.rows.length === 0, r);
r = await as("editor", `select actor_email, item_table, action, detail from public.activity_log order by id`);
const actions = (r.rows || []).map((x) => `${x.actor_email}: ${x.item_table} ${x.action}${x.detail ? " (" + x.detail + ")" : ""}`);
check("the log records every step, with the review note",
  actions.includes("admin@x.org: announcements sent back to draft (Please add the room number.)")
  && actions.includes("admin@x.org: announcements published") && actions.includes("editor@x.org: announcements deleted")
  && actions.includes("admin@x.org: editors added as editor") && actions.includes("admin@x.org: editors removed from the team"), actions);
console.log("    log: " + actions.join(" | "));

// --- the one-time import, as the SQL Editor (nobody signed in) ---
const importSql = execFileSync(process.execPath, [path.join(repo, "scripts/announcements-to-sql.js")], { encoding: "utf8" });
r = await as("sql", importSql);
check("import script output runs in the SQL Editor", !r.error, r);
r = await as("admin", `select count(*)::int as c, bool_and(created_by='${ADMIN}') as owner from public.announcements where title like '%Election%'`);
check("imported rows belong to the admin", !r.error && r.rows[0].c === 1 && r.rows[0].owner === true, r);

console.log(failed ? `${failed} of ${n} SQL checks FAILED` : `${n} SQL checks passed`);
process.exit(failed ? 1 : 0);
