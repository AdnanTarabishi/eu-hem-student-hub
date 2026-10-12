// Diagnostic only; public university timetable endpoints.
const urls = [
 ["master", "https://corsi.unibo.it/2cycle/euHealthEconomicsManagement/timetable/@@orario_reale_json?anno=1"],
 ["course", "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518697/orariolezioni"],
 ["course_alt", "https://www.unibo.it/en/study/course-units-transferable-skills-moocs/course-unit-catalogue/course-unit/2026/518742/orariolezioni"]
];
for (const [name,url] of urls) {
  try {
    const res=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{"User-Agent":"EUHEMStudentHub/1.0 (public academic schedule verification)","Accept":"text/html,application/json"}});
    const body=await res.text();
    console.log("\nSOURCE",name,res.status,res.url,"bytes",body.length,"content-type",res.headers.get("content-type"));
    if (name==="master") {
      let data;try{data=JSON.parse(body)}catch{console.log(body.slice(0,550));continue}
      console.log("ENTRIES",data.length);
      const found=data.filter(s=>String(s.cod_modulo)==="96498" && String(s.start).slice(0,10)==="2026-10-12");
      console.log("MASTER_STAT_OCT12",JSON.stringify(found).slice(0,5000));
      const sample = data.find(s=>String(s.cod_modulo)==="96498");
      console.log("FEED_SAMPLE",JSON.stringify(sample).slice(0,1100));
    } else {
      const i=body.indexOf("Monday, 12 October 2026"),j=body.indexOf("AULA 8");
      console.log("HTML_START",body.slice(0,1500));
      console.log("FOUND_DATES",i,"AULA8",j,"AREA_DATE",i<0?"missing":body.slice(Math.max(0,i-1300),i+2800));
      console.log("AREA_ROOM",j<0?"missing":body.slice(Math.max(0,j-400),j+700));
      console.log("MATCH_TABLE_TOKENS",body.match(/<table|<tr|<time|<li|orario-lezioni|calendario|schedule/gi)?.length);
    }
  } catch(error){console.log("SOURCE",name,"ERROR",String(error))}
}
