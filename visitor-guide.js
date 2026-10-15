// The public tour, suggested routes and directory keep browsing choices in memory.
(() => {
  const main = document.getElementById("visitor-main");
  if (!main) return;
  const $ = id => document.getElementById(id);
  const chapterIds = ["welcome","plan","learn","tools","research","life","community","project"];
  const groups = ["Study","Resources","Community","Life","About"];
  const labels = { available:"Available", preview:"Preview", demo:"Demo data", "not-open":"Not open" };
  const state = { data:null, index:0, all:false, route:"student", search:"", group:"all", status:"all", view:"grid", features:[], loading:false };
  const make = (tag, cls, text) => { const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n; };
  const link = (item, cls) => { const a=make("a",cls,item.label);a.href=item.href;return a; };
  const normal = value => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function safeHref(value) { return typeof value==="string" && /^[a-z0-9-]+\.html(?:[?#][^\s<>]*)?$/i.test(value); }
  function valid(data) {
    const text = value => typeof value==="string" && value.trim().length>0;
    const links = list => Array.isArray(list)&&list.length>0&&list.every(a=>text(a?.label)&&safeHref(a.href));
    if (!data||data.version!==1||!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewed)||!Array.isArray(data.chapters)||data.chapters.length!==8||!Array.isArray(data.routes)||data.routes.length!==3||!Array.isArray(data.extras)) return false;
    if (!data.chapters.every((c,i)=>c.id===chapterIds[i]&&text(c.title)&&text(c.eyebrow)&&text(c.summary)&&text(c.note)&&Array.isArray(c.highlights)&&c.highlights.length===3&&c.highlights.every(text)&&links(c.actions))) return false;
    if (!data.routes.every((r,i)=>r.id===["student","exploring","programme"][i]&&text(r.label)&&text(r.intro)&&links(r.links))) return false;
    return new Set(data.extras.map(x=>x.id)).size===data.extras.length&&data.extras.every(x=>text(x.id)&&text(x.title)&&text(x.icon)&&text(x.description)&&groups.includes(x.group)&&safeHref(x.href)&&Object.hasOwn(labels,x.status));
  }
  function statusFor(item) {
    if (item.preview) return "preview";
    if (item.key==="students") return "demo";
    if (item.key==="join") {
      const endpoint=window.EUHEM_DIRECTORY_CONFIG?.endpoint;
      return typeof endpoint==="string"&&/^https:\/\/.+\/exec$/.test(endpoint.trim())?"available":"not-open";
    }
    return "available";
  }
  function features() {
    const result=[];
    for (const group of SITE_MENU) for (const item of group.items||[]) {
      if (item.key==="visitor-guide") continue;
      const status=statusFor(item);
      let description=item.desc||"Explore this part of the Student Hub.";
      if(item.key==="students")description="Explore the supplied cohort origins map and a separate directory with fictional demo profiles.";
      if(item.key==="join"&&status==="not-open")description="Directory registration is not open. The form explains its current status and future consent choices.";
      if(item.key==="privacy")description="Read information about browser saving, public content and the site's current data handling.";
      if(item.key==="contact")description="Find the current options for questions, ideas and corrections.";
      result.push({id:item.key,title:item.label,group:group.label,href:item.href,icon:item.icon||"guide",description,status});
    }
    return result.concat(state.data.extras);
  }
  function drawChapters() {
    for (const chapter of state.data.chapters) {
      const section=$(chapter.id),copy=section.querySelector(".vg-chapter-copy");
      section.querySelector("h2").textContent=chapter.title;
      copy.querySelector(".vg-summary").textContent=chapter.summary;
      const list=copy.querySelector(".vg-highlights");list.replaceChildren();
      for(const text of chapter.highlights){const li=make("li");li.append(siteIcon("check"),make("span",null,text));list.append(li);}
      const actions=copy.querySelector(".vg-actions");actions.replaceChildren();
      chapter.actions.forEach((item,i)=>{const a=link(item,i?"vg-text-link":"vg-button");a.append(" ",siteIcon("arrow-right"));actions.append(a);});
      copy.querySelector(".vg-chapter-note span").textContent=chapter.note;
    }
  }
  function drawTour() {
    chapterIds.forEach((id,i)=>{$(id).hidden=!state.all&&i!==state.index;});
    main.classList.toggle("visitor-reading-all",state.all);
    document.querySelectorAll("[data-visitor-chapter]").forEach(a=>{
      if(a.dataset.visitorChapter===chapterIds[state.index])a.setAttribute("aria-current","step");
      else a.removeAttribute("aria-current");
    });
    $("visitor-all").setAttribute("aria-pressed",String(state.all));
    $("visitor-all").textContent=state.all?"Use chapter tour":"Read all chapters";
    $("visitor-prev").disabled=state.index===0;
    $("visitor-next").disabled=state.index===chapterIds.length-1;
    $("visitor-position").textContent=(state.index+1)+" / "+chapterIds.length;
    $("visitor-tour-progress").value=state.index+1;
    $("visitor-tour-status").textContent="Chapter "+(state.index+1)+" of "+chapterIds.length+": "+state.data.chapters[state.index].title+(state.all?". All chapters are shown.":".");
  }
  function showChapter(index,{history=false,focus=false}={}) {
    if (!state.data||index<0||index>=chapterIds.length) return;
    state.index=index;drawTour();
    const id=chapterIds[index];
    if(history&&location.hash!=="#"+id)window.history.pushState(null,"","#"+id);
    if(focus){const target=$(id);target.scrollIntoView({block:"start",behavior:"instant"});target.querySelector("h2").focus({preventScroll:true});}
  }
  function drawRoute() {
    const route=state.data.routes.find(r=>r.id===state.route);
    if(!route)return;
    $("visitor-route-intro").textContent=route.intro;
    const links=$("visitor-route-links");links.replaceChildren();
    for(const item of route.links){const a=link(item);a.append(" ",siteIcon("arrow-right"));links.append(a);}
    document.querySelectorAll("[data-visitor-route]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.visitorRoute===route.id)));
    $("visitor-route-status").textContent=route.label+". "+route.links.length+" suggested starting points.";
  }
  function drawDirectory() {
    state.features=features();const box=$("visitor-directory");box.replaceChildren();
    for(const feature of state.features){
      const article=make("article","visitor-feature");
      article.id="feature-"+feature.id;
      article.dataset.featureId=feature.id;article.dataset.group=feature.group;article.dataset.status=feature.status;
      const top=make("div","vg-feature-top"),badge=make("span","vg-badge",labels[feature.status]);badge.dataset.status=feature.status;
      top.append(siteIcon(feature.icon),badge);
      const heading=make("h3");heading.tabIndex=-1;heading.append(link({label:feature.title,href:feature.href},"visitor-feature-link"));
      article.append(top,heading,make("p",null,feature.description),make("span","vg-feature-group",feature.group));
      box.append(article);
    }
    filter();
  }
  function drawMap() {
    document.querySelectorAll("[data-visitor-group]").forEach(button=>{
      const group=button.dataset.visitorGroup;
      const count=state.features.filter(feature=>group==="all"||feature.group===group).length;
      button.querySelector("[data-visitor-group-count]").textContent=count+" destinations";
      button.disabled=false;
    });
    $("visitor-hub-map").hidden=false;
    $("visitor-view-controls").hidden=false;
  }
  function drawView() {
    $("visitor-directory").dataset.view=state.view;
    document.querySelectorAll("[data-visitor-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.visitorView===state.view)));
  }
  function filter() {
    const words=normal(state.search.trim()).split(/\s+/).filter(Boolean);let count=0;
    for(const feature of state.features){
      const text=normal(feature.title+" "+feature.description+" "+feature.group+" "+labels[feature.status]);
      const match=(state.group==="all"||feature.group===state.group)&&(state.status==="all"||feature.status===state.status)&&words.every(w=>text.includes(w));
      $("feature-"+feature.id).hidden=!match;if(match)count++;
    }
    $("visitor-results").textContent=count+" of "+state.features.length+" destinations"+(state.group==="all"?"":" · "+state.group)+(state.status==="all"?"":" · "+labels[state.status])+".";
    $("visitor-empty").hidden=count>0;
    $("visitor-reset").disabled=!(state.search||state.group!=="all"||state.status!=="all");
    document.querySelectorAll("[data-visitor-group]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.visitorGroup===state.group)));
  }
  function reset() {
    state.search="";state.group="all";state.status="all";
    $("visitor-search").value="";$("visitor-group").value="all";$("visitor-status-filter").value="all";filter();
  }
  function revealHash() {
    if(!state.data)return;
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const index=chapterIds.indexOf(id);
    if(index>=0){showChapter(index,{focus:true});return;}
    if(id.startsWith("feature-")&&$(id)){reset();$(id).scrollIntoView({block:"start",behavior:"instant"});$(id).querySelector("h3").focus({preventScroll:true});}
  }
  async function load() {
    if(state.loading)return;state.loading=true;main.setAttribute("aria-busy","true");$("visitor-retry").disabled=true;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
    try{
      const response=await fetch("content/visitor-guide.json",{signal:controller.signal});if(!response.ok)throw new Error("Unavailable guide");
      const data=await response.json();if(!valid(data))throw new Error("Incomplete guide");
      state.data=data;drawChapters();drawDirectory();drawMap();drawView();drawRoute();main.classList.add("visitor-enhanced");
      for(const id of ["visitor-controls","visitor-all","visitor-tour-progress"])$(id).hidden=false;
      for(const id of ["visitor-search","visitor-group","visitor-status-filter"])$(id).disabled=false;
      document.querySelectorAll("[data-visitor-route]").forEach(b=>b.disabled=false);
      $("visitor-load-notice").hidden=true;drawTour();revealHash();
    }catch{
      $("visitor-load-notice").hidden=false;
      $("visitor-results").textContent="The interactive directory is unavailable. Read the chapters and use the direct links below.";
      if(!state.data)chapterIds.forEach(id=>$(id).hidden=false);
    }finally{
      clearTimeout(timer);state.loading=false;main.setAttribute("aria-busy","false");$("visitor-retry").disabled=false;
    }
  }
  document.querySelectorAll("[data-visitor-chapter]").forEach(a=>a.addEventListener("click",event=>{
    if(!state.data||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();showChapter(chapterIds.indexOf(a.dataset.visitorChapter),{history:true,focus:true});
  }));
  $("visitor-prev").addEventListener("click",()=>showChapter(state.index-1,{history:true,focus:true}));
  $("visitor-next").addEventListener("click",()=>showChapter(state.index+1,{history:true,focus:true}));
  $("tour").addEventListener("keydown",event=>{
    if(event.key!=="ArrowLeft"&&event.key!=="ArrowRight")return;
    event.preventDefault();showChapter(state.index+(event.key==="ArrowLeft"?-1:1),{history:true,focus:true});
  });
  $("visitor-all").addEventListener("click",()=>{if(state.data){state.all=!state.all;drawTour();}});
  document.querySelectorAll("[data-visitor-route]").forEach(b=>b.addEventListener("click",()=>{if(state.data){state.route=b.dataset.visitorRoute;drawRoute();}}));
  $("visitor-search").addEventListener("input",event=>{state.search=event.target.value;filter();});
  $("visitor-group").addEventListener("change",event=>{state.group=event.target.value;filter();});
  $("visitor-status-filter").addEventListener("change",event=>{state.status=event.target.value;filter();});
  document.querySelectorAll("[data-visitor-group]").forEach(button=>button.addEventListener("click",()=>{
    if(!state.data)return;
    state.group=button.dataset.visitorGroup;$("visitor-group").value=state.group;filter();
  }));
  document.querySelectorAll("[data-visitor-view]").forEach(button=>button.addEventListener("click",()=>{
    if(!state.data)return;
    state.view=button.dataset.visitorView;drawView();
  }));
  $("visitor-reset").addEventListener("click",()=>{reset();$("visitor-search").focus();});
  $("visitor-retry").addEventListener("click",load);
  window.addEventListener("popstate",revealHash);window.addEventListener("hashchange",revealHash);
  let beforePrint=null;
  window.addEventListener("beforeprint",()=>{if(state.data){beforePrint={all:state.all,index:state.index};state.all=true;drawTour();document.querySelectorAll(".visitor-feature").forEach(n=>n.hidden=false);}});
  window.addEventListener("afterprint",()=>{if(beforePrint){state.all=beforePrint.all;state.index=beforePrint.index;beforePrint=null;drawTour();filter();}});
  // This static showcase works even if the optional directory JSON is unavailable.
  // Normal buttons keep Enter/Space behavior; scenes never rotate automatically.
  const previewButtons=[...document.querySelectorAll("[data-visitor-scene]")];
  previewButtons.forEach((button,index)=>{
    button.disabled=false;
    button.addEventListener("click",()=>{
      previewButtons.forEach(item=>item.setAttribute("aria-pressed",String(item===button)));
      document.querySelectorAll(".vg-showcase-scene").forEach(scene=>{scene.hidden=scene.dataset.scene!==button.dataset.visitorScene;});
      $("visitor-showcase-position").textContent=String(index+1).padStart(2,"0")+" / 06";
      const active=document.querySelector('.vg-showcase-scene[data-scene="'+button.dataset.visitorScene+'"]');
      $("visitor-showcase-status").textContent=active.querySelector("h3").textContent+" Preview "+(index+1)+" of 6.";
    });
  });
  load();
})();
