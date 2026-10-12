const assert = require("node:assert/strict");
const sync = require("../../timetable-sync.js");
const unibo = require("../../unibo-data.js");

const session = (room, code = "96498") => ({
  moduleCode: code, start: "2026-10-12T09:00:00", dateKey: "2026-10-12",
  time: "09:00 - 11:00", room
});
async function main() {
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  const now = Date.parse("2026-10-12T10:00:00Z");
  const old = [session("AULA 1 · Piano Terra · Piazza Scaravilli 1/2")];
  const updated = [session("AULA 8 SALA DELLE FESTE · Piano Primo · Via Zamboni 22")];

  assert.equal(sync.read(storage, "2026-27", now), null);
  assert.equal(sync.save(storage, "2026-27", old, new Date(now).toISOString()), true);
  assert.deepEqual(sync.read(storage, "2026-27", now).sessions, old);
  assert.equal(sync.read(storage, "2025-26", now), null);
  assert.equal(sync.read(storage, "2026-27", now + 8 * 86400000), null);
  assert.deepEqual(sync.roomChanges(old, updated).map(change => [change.before, change.after]),
    [[old[0].room, updated[0].room]]);
  assert.equal(sync.roomChanges(old, [{...updated[0], room: updated[0].room.toLowerCase()}]).length, 1);
  assert.deepEqual(sync.roomChanges(old, old), []);
  assert.deepEqual(sync.roomChanges([], updated), []);
  assert.deepEqual(sync.roomChanges(old, [session("")]), []);
  assert.equal(sync.read({ getItem: () => { throw Error("blocked"); } }, "2026-27"), null);
  assert.equal(sync.save({ setItem: () => { throw Error("blocked"); } }, "2026-27", old, new Date(now).toISOString()), false);
  console.log("  ok  Verified snapshots, expiry, location diffs and blocked storage");

  let calls = 0, pauses = [], optionsSeen = [];
  const fetching = async (_, options) => {
    calls++; optionsSeen.push(options);
    if (calls < 3) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify([{cod_modulo:"96498",title:"Statistics",start:"2026-10-12T09:00:00",end:"2026-10-12T11:00:00",time:"09:00 - 11:00",aule:[{des_risorsa:"AULA 8",des_piano:"Piano Primo",des_indirizzo:"Via Zamboni, 22"}]}]),
      {status:200,headers:{"Content-Type":"application/json"}});
  };
  const sessions = await unibo.fetchTimetable("https://example.invalid/timetable", {
    attempts: 3, delayMs: 1, fetcher: fetching, pause: async ms => {pauses.push(ms);}
  });
  assert.equal(calls, 3);
  assert.deepEqual(pauses, [1, 2]);
  assert.ok(optionsSeen.every(option => option.cache === "no-store"));
  assert.equal(sessions[0].classrooms[0].name, "AULA 8");
  assert.equal(sessions[0].classrooms[0].floor, "Piano Primo");
  assert.equal(sessions.sourceMeta.cachedAt, "");
  console.log("  ok  Temporary 503 failures retry and preserve official classroom details");

  calls = 0;
  await assert.rejects(() => unibo.requestOfficialTimetable("https://example.invalid",{
    fetcher: async () => {calls++;return new Response("missing",{status:404})},pause:async()=>{}
  }), /HTTP 404/);
  assert.equal(calls,1);
  await assert.rejects(() => unibo.requestOfficialTimetable("https://example.invalid",{
    fetcher: async () => new Response('{"bad":"schema"}'),pause:async()=>{}
  }), /invalid official response/);
  console.log("  ok  Permanent errors and invalid source payloads are not interpreted as sessions");

  const cache = await unibo.fetchTimetable("https://example.invalid",{
    fetcher: async () => new Response("[]",{headers:{"x-saved-at":"2026-10-11T20:00:00Z"}})
  });
  assert.equal(cache.sourceMeta.cachedAt, "2026-10-11T20:00:00Z");
  console.log("  ok  Previously cached source is explicitly marked as cached");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
