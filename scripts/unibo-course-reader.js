// Parse visible lesson rows from the University's course-unit pages.
// Important: UniBo currently renders a stale 2015 data-start attribute in these
// rows. The human-visible calendar date (bigger/smaller spans) is authoritative.
const MONTHS = Object.fromEntries([
  "january","february","march","april","may","june","july","august",
  "september","october","november","december"
].map((name,index)=>[name,String(index+1).padStart(2,"0")]));

function textOf(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<br\s*\/?\s*>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;|&#34;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
    .replace(/\s+/g," ").trim();
}

function displayedDate(cell) {
  const day=cell.match(/<span\b[^>]*class=["'][^"']*\bbigger\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  const yearMonth=cell.match(/<span\b[^>]*class=["'][^"']*\bsmaller\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if(!day || !yearMonth) return null;
  const match=textOf(yearMonth[1]).match(/^([a-z]+)\s+(\d{4})$/i);
  const month=match && MONTHS[match[1].toLowerCase()], dd=Number(textOf(day[1])), year=match && Number(match[2]);
  if(!month || !Number.isInteger(dd) || dd<1 || dd>31) return null;
  const date=new Date(Date.UTC(year,Number(month)-1,dd));
  if(date.getUTCFullYear()!==year || date.getUTCMonth()+1!==Number(month) || date.getUTCDate()!==dd) return null;
  return `${year}-${month}-${String(dd).padStart(2,"0")}`;
}

function parseCourseHtml(html, module, academicStartYear=2026) {
  if (!module?.code || !module?.name) throw Error("Module metadata is required");
  const content=String(html || "").replace(/<!--[\s\S]*?-->/g," ");
  const visible=textOf(content);
  const header=new RegExp(`Course Timetable\\s+${String(module.code).replace(/[^A-Za-z0-9]/g,"")}\\b`,"i");
  if (!header.test(visible)) throw Error(`Course page does not identify module ${module.code}`);
  if (!visible.includes(`${academicStartYear}/${academicStartYear+1}`)) throw Error("Wrong academic year in UniBo source");

  const sessions=[];
  const seen=new Set();
  let dateKey=null, rows=0;
  const tr=/<tr\b[^>]*\bdata-start=["'][^"']+["'][^>]*>([\s\S]*?)<\/tr>/gi;
  for (const [, body] of content.matchAll(tr)) {
    const cells=[...body.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match=>match[1]);
    if(cells.length<2)continue;
    const nextDate=displayedDate(cells[0]);
    if(nextDate) dateKey=nextDate;
    if(!dateKey)continue;
    const tIndex=nextDate ? 1 : 0;
    const match=textOf(cells[tIndex]).match(/\b(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\b/);
    if(!match)continue;
    const normalizeTime=value=>value.padStart(5,"0");
    const startTime=normalizeTime(match[1]),endTime=normalizeTime(match[2]);
    if(startTime>=endTime)continue;
    const year=Number(dateKey.slice(0,4));
    if(year!==academicStartYear && year!==academicStartYear+1)continue;

    const locationCell=cells[tIndex+1]||"";
    const roomSpans=[...locationCell.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .map(found=>textOf(found[1])).filter(Boolean);
    const online=/online only|online lesson|online class/i.test(textOf(locationCell));
    const classrooms=!online && roomSpans.length ? [{
      name:roomSpans[0]||"",floor:roomSpans[1]||"",
      building:roomSpans[2]||"",address:roomSpans[3]||""
    }] : [];
    const room=classrooms.map(room=>[room.name,room.floor,room.building,room.address].filter(Boolean).join(" · ")).join(" + ");
    const note=cells.slice(tIndex+2).map(textOf).filter(Boolean).join(" · ");
    const key=[module.code,dateKey,startTime,endTime,room].join("|");
    if(seen.has(key))continue;
    seen.add(key);rows++;
    sessions.push({
      moduleCode:String(module.code),feedTitle:module.name,
      dateKey,start:`${dateKey}T${startTime}:00`,end:`${dateKey}T${endTime}:00`,
      time:`${startTime} - ${endTime}`,classrooms,room,
      teacher:Array.isArray(module.professors)?module.professors.join(", "):"",
      online,note
    });
  }
  if(!rows) throw Error(`No validated visible timetable rows found for ${module.code}`);
  return sessions.sort((a,b)=>a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

module.exports={parseCourseHtml,displayedDate,textOf};
