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
  assert.deepEqual(sync.read(storage, "2026-27", now + 8 * 86400000).sessions, old);
  assert.equal(sync.read(storage, "2026-27", now + 91 * 86400000), null);
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

  const source="https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/timetable/@@orario_reale_json?anno=1&start=2026-09-01&end=2026-12-31&calendar_view=";
  const windows=unibo.timetableRequestUrls(source).map(address=>new URL(address));
  assert.equal(windows.length,4);
  assert.equal(windows[0].searchParams.get("start"),"2026-09-01");
  assert.equal(windows.at(-1).searchParams.get("end"),"2026-12-31");
  for(let i=0;i<windows.length;i++){
    const begin=Date.parse(windows[i].searchParams.get("start")),end=Date.parse(windows[i].searchParams.get("end"));
    assert.ok(end>=begin&&end-begin<=30*86400000,"UniBo requests contain at most31inclusive days");
    assert.equal(windows[i].searchParams.get("anno"),"1");
    assert.equal(windows[i].searchParams.get("calendar_view"),"");
    if(i)assert.equal(begin,Date.parse(windows[i-1].searchParams.get("end"))+86400000,"no missing or overlapping source dates");
  }
  let windowCalls=0;
  const all=await unibo.requestOfficialTimetable(source,{attempts:1,fetcher:async address=>{
    windowCalls++;
    const date=new URL(address).searchParams.get("start");
    return new Response(JSON.stringify([{extCode:"fictional-"+date,cod_modulo:"96498",start:date+"T09:00:00",end:date+"T11:00:00"}]));
  }});
  assert.equal(windowCalls,4);assert.equal(all.raw.length,4);assert.equal(all.sourceUrls.length,4);
  await assert.rejects(unibo.requestOfficialTimetable(source,{attempts:1,fetcher:async address=>
    new URL(address).searchParams.get("start")==="2026-10-02"?new Response("unavailable",{status:503}):new Response("[]")}),/503/,
    "a later failed date window cannot be treated as a complete source refresh");
  assert.throws(()=>unibo.timetableRequestUrls(source.replace("2026-12-31","2026-08-31")),/date range/);
  console.log("  ok  Complete official timetable coverage uses bounded date windows and rejects partial refreshes");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
