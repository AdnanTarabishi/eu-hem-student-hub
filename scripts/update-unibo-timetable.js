// Produce a static, source-attributed timetable from the *working* UniBo
// course-unit webpages, independently of the failing programme JSON endpoint.
// Run by GitHub Actions; only public university lesson data is published.
const fs=require("node:fs");
const path=require("node:path");
const {parseCourseHtml}=require("./unibo-course-reader.js");
const ROOT=path.resolve(__dirname,"..");
const PROGRAMME=path.join(ROOT,"content","programme.json");
const DEST=path.join(ROOT,"data","unibo-verified-timetable.json");

function romeDay(now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{
    timeZone:"Europe/Rome",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(now).map(x=>[x.type,x.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function moduleList(programme) {
  const cohort=programme.cohorts.find(x=>x.id===programme.cohorts[0].id);
  const term=cohort.terms.find(x=>x.id==="y1-s1")||cohort.terms[0];
  return {cohort,term,modules:term.courses.flatMap(c=>c.modules)};
}

async function fetchCourse(url,fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))) {
  const retryable=new Set([408,429,500,502,503,504]);
  let lastError;
  for(let attempt=0;attempt<3;attempt++) {
    try{
      const response=await fetcher(url,{
        headers:{"Accept":"text/html","User-Agent":"EU-HEM Student Hub (academic timetable verification)"},
        cache:"no-store",signal:AbortSignal.timeout(25000)
      });
      if(!response.ok){
        const error=new Error(`HTTP ${response.status}`);
        error.retryable=retryable.has(response.status);
        throw error;
      }
      const html=await response.text();
      if(html.length<500)throw Error("Course HTML was unexpectedly short");
      return html;
    }catch(e){
      lastError=e;
      if(e.retryable===false || attempt===2)break;
      await pause(800*(attempt+1));
    }
  }
  throw lastError;
}

function validPrevious(snapshot,cohortId,termId){
  return snapshot && snapshot.schemaVersion===1 && snapshot.cohort===cohortId &&
    snapshot.term===termId && Array.isArray(snapshot.sessions) && snapshot.modules && typeof snapshot.modules==="object";
}

async function buildVerifiedTimetable(programme,previous,opts={}) {
  const {cohort,term,modules}=moduleList(programme);
  const checkedAt=(opts.now||new Date()).toISOString();
  const today=romeDay(opts.now||new Date());
  const valid=validPrevious(previous,cohort.id,term.id)?previous:null;
  const outModules={},collected=[];
  const fetcher=opts.fetcher||fetch;
  let verified=0,verifiedCurrent=0,currentCount=0;
  for (const module of modules) {
    const sourceUrl=module.officialUrl ? module.officialUrl.replace(/\/$/,"")+"/orariolezioni" : "";
    const current=!module.teachingEnd || module.teachingEnd>=today;
    if(current)currentCount++;
    try {
      if(!sourceUrl)throw Error("No official course timetable URL");
      const html=await fetchCourse(sourceUrl,fetcher,opts.pause);
      const entries=parseCourseHtml(html,module,Number(cohort.id.slice(0,4)));
      if(entries.length>1000)throw Error("Unusually large class count");
      collected.push(...entries);
      outModules[module.code]={sourceUrl,verifiedAt:checkedAt,state:"verified",count:entries.length};
      verified++;if(current)verifiedCurrent++;
    }catch(error) {
      const prior=valid?.sessions.filter(x=>x.moduleCode===module.code)||[];
      const oldInfo=valid?.modules[module.code];
      if(prior.length)collected.push(...prior);
      outModules[module.code]={
        sourceUrl,
        verifiedAt:oldInfo?.verifiedAt||"",
        state:prior.length?"previous":"unavailable",
        count:prior.length,
        reason:String(error.message||error).slice(0,160)
      };
      console.warn(`UniBo course ${module.code}: ${error.message}; ${prior.length?"retained last verified copy":"no saved lessons"}`);
    }
  }
  if(!verified)throw Error("No official course page verified. Previous published data must remain unchanged.");
  const seen=new Set();
  const sessions=collected.sort((a,b)=>a.start.localeCompare(b.start)||a.moduleCode.localeCompare(b.moduleCode))
    .filter(s=>{const key=[s.moduleCode,s.start,s.end,s.room].join("|");if(seen.has(key))return false;seen.add(key);return true});
  if(sessions.length<3)throw Error("Too few verified classes; refusing destructive publication");
  return {
    schemaVersion:1,source:"UniBo course-unit timetable pages",cohort:cohort.id,term:term.id,
    checkedAt,verifiedModules:verified,trackedModules:modules.length,
    verifiedCurrentModules:verifiedCurrent,currentModules:currentCount,
    partial:verifiedCurrent!==currentCount,
    modules:outModules,sessions
  };
}

async function main() {
  const programme=JSON.parse(fs.readFileSync(PROGRAMME,"utf8"));
  const previous=fs.existsSync(DEST)?JSON.parse(fs.readFileSync(DEST,"utf8")):null;
  const output=await buildVerifiedTimetable(programme,previous);
  fs.mkdirSync(path.dirname(DEST),{recursive:true});
  const encoded=JSON.stringify(output,null,2)+"\n";
  fs.writeFileSync(DEST,encoded);
  console.log(`Verified UniBo pages: ${output.verifiedModules}/${output.trackedModules}; current or future modules ${output.verifiedCurrentModules}/${output.currentModules}; ${output.sessions.length} sessions; partial=${output.partial}`);
  console.log("Statistics 12 October:",JSON.stringify(output.sessions.filter(x=>x.moduleCode==="96498"&&x.dateKey==="2026-10-12")));
}

if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={buildVerifiedTimetable,romeDay,fetchCourse,moduleList};
