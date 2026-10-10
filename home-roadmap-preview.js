// Homepage roadmap browsers use the same validated published data as Roadmap & Updates.
// Controls are manual; no auto-rotation, new storage or personal data collection.
async function fillRoadmapPreview() {
  const box = document.getElementById("roadmap-preview");
  if (!box || typeof EUHEM_ROADMAP === "undefined") return;
  const R = EUHEM_ROADMAP;
  const load = async url => { try { const response = await fetch(url, { cache: "no-cache" }); return response.ok ? await response.json() : null; } catch { return null; } };
  const [roadmap, updates] = await Promise.all([load("content/roadmap.json"), load("content/updates.json")]);
  const plan = roadmap && R.readRoadmap(roadmap);
  const currentWork = plan ? plan.items.filter(item => item.lane === "now") : [];
  const latest = updates ? R.publishedUpdates(updates) : [];
  if (!currentWork.length && !latest.length) { box.closest(".eh-roadmap").hidden = true; return; }
  box.replaceChildren();
  if (plan && plan.vision && plan.vision.progressPercent !== null) {
    const percent = plan.vision.progressPercent;
    const progress = createElement("div", "eh-roadmap-progress"), heading = createElement("div", "eh-roadmap-progress-heading");
    heading.append(createElement("span", null, "Building the full Student Hub"), createElement("strong", null, `${percent}% complete`));
    const bar = createElement("div", "eh-roadmap-progress-bar");
    for (const [key, value] of Object.entries({role:"progressbar","aria-label":"Student Hub development (our estimate)","aria-valuemin":"0","aria-valuemax":"100","aria-valuenow":String(percent)})) bar.setAttribute(key,value);
    const fill = createElement("span", "eh-roadmap-progress-fill"); fill.style.width = `${percent}%`; bar.appendChild(fill);
    progress.append(heading, bar, createElement("p", "eh-roadmap-progress-note", "Our own estimate of the full plan.")); box.appendChild(progress);
  }
  function pager(id, previousLabel, nextLabel, onMove, vertical = false) {
    const controls = createElement("div", "home-preview-controls"), counter = createElement("span", "home-preview-counter");
    counter.setAttribute("role", "status"); counter.setAttribute("aria-live", "polite"); counter.setAttribute("aria-atomic", "true");
    const buttons = [-1,1].map((direction,index) => {
      const button = createElement("button", "home-preview-arrow"); button.type = "button";
      button.setAttribute("aria-label", index ? nextLabel : previousLabel); button.setAttribute("aria-controls", id);
      button.appendChild(siteIcon(vertical ? (index ? "chevron-down" : "chevron-up") : (index ? "chevron-right" : "chevron-left")));
      button.addEventListener("click", () => { if (button.getAttribute("aria-disabled") !== "true") onMove(direction); }); return button;
    });
    controls.append(counter,...buttons);
    return { controls, update(first,last,count) {
      counter.textContent = first === last ? `${first+1} / ${count}` : `${first+1}–${last+1} / ${count}`;
      buttons[0].setAttribute("aria-disabled",String(first===0)); buttons[1].setAttribute("aria-disabled",String(last>=count-1)); controls.hidden = count <= last-first+1;
    }};
  }
  if (currentWork.length) {
    let index=0;
    const panel=createElement("div","home-focus-panel"), card=createElement("a","roadmap-preview-now"); card.id="home-current-work";
    const navigation=pager(card.id,"Previous work in progress","Next work in progress",step=>{index=Math.max(0,Math.min(currentWork.length-1,index+step));draw();});
    const parts=[plan.release&&`${plan.release.stage} ${plan.release.version}`,plan.vision&&plan.vision.progressPercent!==null&&`about ${plan.vision.progressPercent}% of the full plan built`,updates&&R.releaseCount(updates).text,plan.vision&&`full Hub: ${plan.vision.targetLabel}`].filter(Boolean);
    function draw() {
      const item=currentWork[index]; card.href=`roadmap.html#feature-${item.id}`;
      const label=createElement("span","roadmap-preview-label"); label.append(createElement("span","roadmap-preview-dot"),document.createTextNode(`Now · ${R.ROADMAP_STATUS[item.status]}`));
      card.replaceChildren(label,createElement("strong",null,item.title),createElement("span","home-focus-summary",item.summary));
      if(parts.length)card.appendChild(createElement("span","roadmap-preview-progress",parts.join(" · ")));
      card.appendChild(createElement("span","roadmap-preview-more","See what is planned next →"));navigation.update(index,index,currentWork.length);
    }
    panel.append(card,navigation.controls);box.appendChild(panel);draw();
  }
  if(latest.length) {
    let offset=0;const pageSize=3;
    const panel=createElement("div","roadmap-preview-latest"),heading=createElement("div","home-preview-heading"),title=createElement("h3",null,"Latest releases"),list=createElement("ol","home-release-window");
    title.id="home-release-title";list.id="home-release-list";list.setAttribute("aria-labelledby",title.id);
    const navigation=pager(list.id,"Newer releases","Older releases",step=>{offset=Math.max(0,Math.min(Math.floor((latest.length-1)/pageSize)*pageSize,offset+step*pageSize));draw();},true);
    function draw() {
      list.replaceChildren();list.start=offset+1;
      for(const item of latest.slice(offset,offset+pageSize)) {
        const li=createElement("li"),date=createElement("time",null,R.dayLabel(item.date)),link=createElement("a",null,item.title);date.dateTime=item.date;link.href=`roadmap.html#update-${item.id}`;link.title=item.title;
        li.append(date,createElement("span",`roadmap-preview-type is-${item.type}`,R.UPDATE_TYPES[item.type]),link);list.appendChild(li);
      }
      navigation.update(offset,Math.min(offset+pageSize,latest.length)-1,latest.length);
    }
    heading.append(title,navigation.controls);panel.append(heading,list);box.appendChild(panel);draw();
  }
}
