// Shared helpers for the Universities section. Academic routes stay in content/tracks.json.
(function(root){
  "use strict";
  const CONTENT_URL="content/universities.json";
  const CHECKLIST_PREFIX="euhem-university-checklist-v1";
  const asArray=v=>Array.isArray(v)?v:[];
  async function loadUniversities(){
    const r=await fetch(CONTENT_URL,{credentials:"same-origin"});
    if(!r.ok) throw new Error("University guide unavailable ("+r.status+")");
    const file=await r.json();
    if(!file || !Array.isArray(file.universities) || !file.universities.length) throw new Error("University guide format is invalid.");
    return file;
  }
  function universityById(file,id){ return asArray(file?.universities).find(u=>u.id===id)||null; }
  function latestCohort(file,requested){
    const cs=asArray(file?.cohorts);
    return cs.find(c=>c.id===requested)||cs[cs.length-1]||null;
  }
  function universityRoles(cohort,id,trackId=""){
    if(!cohort) return [];
    const tracks=asArray(cohort.tracks).filter(t=>!trackId||t.id===trackId), out=[];
    if(cohort.semester1?.university===id) out.push({semester:1,kind:"common",tracks});
    for(const t of tracks) for(const s of asArray(t.semesters)) if(s.university===id) out.push({semester:s.number,kind:"teaching",tracks:[t]});
    const thesis=tracks.filter(t=>asArray(t.thesis).includes(id));
    if(thesis.length) out.push({semester:4,kind:"thesis",tracks:thesis});
    return out;
  }
  function roleText(role){
    if(role.kind==="common") return "Semester 1 · Common foundation";
    const names=role.tracks.map(t=>t.abbr||t.name).join(", ");
    return "Semester "+role.semester+(role.kind==="thesis"?" · Thesis option · ":" · ")+names;
  }
  function universityCourses(cohort,id,trackId){
    const track=asArray(cohort?.tracks).find(t=>t.id===trackId);
    if(!track) return [];
    const seen=new Map();
    for(const sem of asArray(track.semesters)){
      if(sem.university!==id) continue;
      for(const cid of asArray(sem.required)){
        const c=cohort.courses?.[cid]; if(c) seen.set(cid,{id:cid,...c,semester:sem.number,status:"Required"});
      }
      for(const choice of asArray(sem.choices)) for(const option of asArray(choice.options)) for(const cid of asArray(option)){
        const c=cohort.courses?.[cid]; if(c&&!seen.has(cid)) seen.set(cid,{id:cid,...c,semester:sem.number,status:choice.rule||"Elective"});
      }
    }
    return [...seen.values()];
  }
  function trackJourney(cohort,trackId){
    const t=asArray(cohort?.tracks).find(x=>x.id===trackId); if(!t) return [];
    const a=[]; if(cohort.semester1?.university) a.push({semester:1,ids:[cohort.semester1.university],kind:"common"});
    for(const s of asArray(t.semesters)) a.push({semester:s.number,ids:[s.university],kind:"teaching"});
    if(asArray(t.thesis).length) a.push({semester:4,ids:[...t.thesis],kind:"thesis"});
    return a.sort((x,y)=>x.semester-y.semester);
  }
  function checklistKey(id,cohort){ return CHECKLIST_PREFIX+":"+id+":"+(cohort||"general"); }
  function readChecklist(key){
    try{ const v=JSON.parse(localStorage.getItem(key)||'{"completed":[]}'); return new Set(asArray(v.completed)); }
    catch{return new Set();}
  }
  function writeChecklist(key,set){ try{localStorage.setItem(key,JSON.stringify({completed:[...set]})); return true;}catch{return false;} }
  function profileUrl(id,cohort,track){ const p=new URLSearchParams({id}); if(cohort)p.set("cohort",cohort); if(track)p.set("track",track); return "university.html?"+p; }
  root.UniversityData={CONTENT_URL,CHECKLIST_PREFIX,asArray,loadUniversities,universityById,latestCohort,universityRoles,roleText,universityCourses,trackJourney,checklistKey,readChecklist,writeChecklist,profileUrl};
})(window);