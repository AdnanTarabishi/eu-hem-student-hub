// Confirm a real browser renders the published course-page snapshot WITHOUT
// ever reading the currently broken degree-wide UniBo JSON endpoint.
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const ROOT=path.resolve(process.argv[2]||".");
const snap=JSON.parse(fs.readFileSync(path.join(ROOT,"data/unibo-verified-timetable.json"),"utf8"));
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json",".svg":"image/svg+xml",".woff2":"font/woff2",".png":"image/png",".webmanifest":"application/manifest+json"};
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    const target=path.resolve(ROOT,pathname.slice(1)||"index.html");
    if(!target.startsWith(ROOT+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){
      res.writeHead(404);return res.end("missing");
    }
    res.writeHead(200,{"Content-Type":MIME[path.extname(target)]||"application/octet-stream"});
    res.end(fs.readFileSync(target));
  }).listen(0,"127.0.0.1");
  await new Promise(resolve=>server.on("listening",resolve));
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(fs.existsSync("/usr/bin/chromium")?"/usr/bin/chromium":undefined),args:["--no-sandbox"]});
  try{
    const context=await browser.newContext({serviceWorkers:"block",timezoneId:"Europe/Rome",viewport:{width:390,height:844}});
    await context.clock.setFixedTime(new Date(Date.parse(snap.checkedAt)+60000));
    let masterCalls=0;
    await context.route(/^https?:\/\//,route=>{
      const url=new URL(route.request().url());
      if(url.hostname==="corsi.unibo.it"){masterCalls++;return route.abort("failed");}
      if(url.hostname!=="127.0.0.1")return route.abort();
      return route.continue();
    });
    const page=await context.newPage();
    const errors=[];page.on("pageerror",err=>errors.push(err.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/timetable.html?view=day&date=2026-10-12`);
    await page.waitForFunction(()=>typeof timetable!=="undefined"&&timetable.ready);
    const info=await page.evaluate(()=>{
      const target=timetable.sessions.find(s=>s.moduleCode==="96498"&&s.dateKey==="2026-10-12");
      return {session:target,kind:timetable.sourceKind,verifiedAt:timetable.verifiedAt,stale:timetable.stale};
    });
    assert.equal(info.kind,"course-pages");
    assert.equal(info.verifiedAt,snap.checkedAt);
    assert.equal(info.stale,false);
    assert.equal(info.session.start,"2026-10-12T09:00:00");
    assert.equal(info.session.end,"2026-10-12T12:00:00");
    assert.match(info.session.room,/AULA 8.*SALA DELLE FESTE/);
    assert.equal(masterCalls,0,"a valid published snapshot must never need the broken UniBo master feed");
    await page.locator(".tt-class-title").filter({hasText:/Fundamentals of Statistics/i}).first().click();
    assert.match(await page.locator("#session-dialog").innerText(),/VIA Zamboni 22/);
    assert.match(await page.locator("#session-dialog").innerText(),/First floor/);
    assert.ok((await page.locator('#session-dialog a[href*="518697/orariolezioni"]').count())===1);
    assert.deepEqual(errors,[]);
    console.log("  ok  Published course-page snapshot renders Aula 8, 09–12, with zero calls to broken UniBo JSON");
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
