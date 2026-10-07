/* Student Toolkit UI. Existing workspaces open via normal links. Preferences
 * store only known catalogue IDs. Recent history is opt-in and local only.
 */
(function () {
  'use strict';
  const D=window.StudentToolkitData,root=document.getElementById('toolkit-main');
  if(!D||!root)return;
  const $=id=>root.querySelector('#'+id),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=name=>`<svg class="icon" aria-hidden="true"><use href="icons.svg#${esc(name)}"></use></svg>`;
  const kinds={builtin:'Built-in / Hub',external:'External',planned:'Planned'};
  const KEY='euhem-toolkit-v1';
  let storageOK=true,prefs=D.cleanPreferences({}),state,shown=9,plansShown=3,activeTool=null,lastOpener=null,queryTimer=null;
  const dialog=$('tk-dialog');
  try { const raw=window.localStorage.getItem(KEY); if(raw) { try{prefs=D.cleanPreferences(JSON.parse(raw));}catch(_){prefs=D.cleanPreferences({});} } }
  catch(_){storageOK=false;}
  function readURL(){return D.cleanState(Object.fromEntries(new URLSearchParams(window.location.search)));}
  state=readURL();
  function writePreferences(){
    prefs=D.cleanPreferences(prefs);
    try { window.localStorage.setItem(KEY,JSON.stringify(prefs)); }
    catch(_){storageOK=false;}
    $('tk-storage-warning').hidden=storageOK;
  }
  function urlFor(toolId=null){
    const url=new URL(window.location.href);
    url.hash='';url.search='';
    for(const [key,value] of Object.entries(state)) {
      const defaults=D.cleanState({});
      if(value!==defaults[key])url.searchParams.set(key,typeof value==='boolean'?'1':value);
    }
    const current=new URL(window.location.href);
    for(const key of ['section','collection'])if(current.searchParams.has(key))url.searchParams.set(key,current.searchParams.get(key));
    if(toolId)url.searchParams.set('tool',toolId);
    return url;
  }
  function syncURL(){
    try{window.history.replaceState(null,'',urlFor(activeTool).href);}catch(_){/* Embedded/file previews can forbid history writes. */}
  }
  function availableHref(t){
    if(t.kind==='planned'||!D.safeHref(t.href,t.kind==='external'))return null;
    return t.href;
  }
  function launch(t,label,className='tk-button'){
    const href=availableHref(t);if(!href)return '';
    return `<a class="${className}" href="${esc(href)}" data-launch="${esc(t.id)}"${t.kind==='external'?' target="_blank" rel="noopener noreferrer" aria-label="'+esc(label+' '+t.title+' (external site, opens in a new tab)')+'"':''}>${esc(label)} ${icon(t.kind==='external'?'external':'arrow-right')}</a>`;
  }
  function saveButton(t,className='tk-icon-button'){
    const saved=prefs.saved.includes(t.id),label=(saved?'Remove from saved: ':'Save to this device: ')+t.title;
    return `<button type="button" class="${className}" data-save="${esc(t.id)}" aria-pressed="${saved}" aria-label="${esc(label)}" title="${esc(label)}">${icon('bookmark')}</button>`;
  }
  function card(t){
    return `<article class="tk-tool" id="tool-${esc(t.id)}" data-kind="${t.kind}" data-category="${t.category}"><div class="tk-tool-top"><span class="tk-tool-symbol">${icon(t.icon)}</span><span class="tk-badge tk-badge-${t.kind}">${kinds[t.kind]}</span>${saveButton(t)}</div><h4>${esc(t.title)}${t.fresh?'<span class="tk2-new-badge">New</span>':''}</h4><p class="tk-tool-description">${esc(t.summary)}</p><div class="tk-tool-meta">${esc(t.kind==='planned'?'Proposed scope · no release date':t.collection||'Independent provider')}</div><div class="tk-tool-actions">${t.kind==='planned'?`<button type="button" class="tk-button" data-detail="${t.id}">See the plan ${icon('arrow-right')}</button>`:launch(t,t.kind==='external'?'Visit site':'Open tool')+`<button type="button" class="tk-text-button" data-detail="${t.id}" aria-label="About ${esc(t.title)}">Details</button>`}</div><div class="tk2-card-actions"><button type="button" class="tk-text-button" data-add-list="${t.id}">Add to list</button>${t.kind!=='planned'?`<button type="button" class="tk-text-button" data-compare="${t.id}" aria-pressed="false">Compare</button>`:'<span class="tk-meta tk-small">Idea, not a live tool</span>'}</div></article>`;
  }
  function quick(t,subtitle){
    return `<button type="button" class="tk-quick" data-detail="${t.id}"><span class="tk-tool-symbol">${icon(t.icon)}</span><div><strong>${esc(t.title)}</strong><small>${esc(subtitle||kinds[t.kind])}</small></div><span aria-hidden="true">›</span></button>`;
  }
  function sidebar(){
    $('tk-starters').innerHTML=[['descriptive','Understand a dataset'],['zotero','Organise your references'],['city-guides','Prepare for your next city']].map(([id,s])=>quick(D.byId.get(id),s)).join('');
    $('tk-favourites').innerHTML=prefs.saved.length?prefs.saved.slice(0,4).map(id=>quick(D.byId.get(id))).join(''):'<p class="tk-side-empty">Keep your useful finds close. Select the bookmark on any tool to save it here.</p>';
    $('tk-recents').innerHTML=!prefs.rememberRecent?'<p class="tk-side-empty">Turn this on to keep a short list of tools you open from the Toolkit.</p>':prefs.recent.length?prefs.recent.slice(0,4).map(id=>quick(D.byId.get(id))).join(''):'<p class="tk-side-empty">Your list starts with the next tool you open from this page.</p>';
    $('tk-remember').checked=prefs.rememberRecent;
    $('tk-saved-count').textContent=prefs.saved.length;
  }
  function syncControls(){
    $('tk-search').value=state.q;
    $('tk-fresh').checked=state.fresh;
    for(const k of ['kind','course','sort','city'])$('tk-'+k).value=state[k];
    $('tk-all').setAttribute('aria-pressed',String(!state.saved));$('tk-saved').setAttribute('aria-pressed',String(state.saved));
    $('tk-grid').setAttribute('aria-pressed',String(state.view==='grid'));$('tk-list').setAttribute('aria-pressed',String(state.view==='list'));
    root.querySelectorAll('[data-category-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.categoryFilter===state.category)));
    if(state.kind!=='all'||state.course!=='all'||state.city!=='all'||state.fresh||state.sort!=='curated')root.querySelector('.tk-refine').open=true;
  }
  function render(){
    const list=D.selectItems(state,prefs.saved),live=list.filter(t=>t.kind!=='planned'),planned=list.filter(t=>t.kind==='planned');
    const active=state.q||state.category!=='all'||state.kind!=='all'||state.course!=='all'||state.city!=='all'||state.fresh||state.saved;
    $('tk-results-heading').textContent=state.saved?'Your useful finds.':state.category==='all'?'Find something useful.':D.categories.find(c=>c.id===state.category).label+'.';
    $('tk-results-summary').textContent=`${live.length} available ${live.length===1?'entry':'entries'} · ${planned.length} planned ${planned.length===1?'idea':'ideas'}${state.saved?' in your saved list':''}. ${active?'Results match all selected filters.':'Built-in tools, existing Hub workspaces and selected external services.'}`;
    $('tk-results').innerHTML=live.slice(0,shown).map(card).join('');
    $('tk-plans').innerHTML=planned.slice(0,plansShown).map(card).join('');
    for(const id of ['tk-results','tk-plans'])$(id).classList.toggle('tk-list-view',state.view==='list');
    $('tk-available').hidden=live.length===0;$('tk-planned').hidden=planned.length===0;
    $('tk-available-count').textContent=String(live.length);$('tk-planned-count').textContent=String(planned.length);
    $('tk-more').hidden=shown>=live.length;$('tk-more').textContent=`Show more available tools (${Math.max(0,live.length-shown)} remaining)`;
    $('tk-more-plans').hidden=plansShown>=planned.length;$('tk-more-plans').textContent=`Explore more plans (${Math.max(0,planned.length-plansShown)} remaining)`;
    $('tk-empty').hidden=list.length>0;
    $('tk-empty-title').textContent=state.saved&&!prefs.saved.length?'Your shortlist starts here.':'No matches yet.';
    $('tk-empty-copy').textContent=state.saved&&!prefs.saved.length?'Use the bookmark on a tool or planned idea. It will stay on this device.':'Try a broader word, select another type, or clear the filters.';
    $('tk-reset').hidden=!active;
    $('tk-lab-feature').hidden=Boolean(active);
    $('tk-storage-warning').hidden=storageOK;
    syncControls();sidebar();syncURL();
    root.dispatchEvent(new CustomEvent('toolkit:render'));
  }
  function apply(patch){state=D.cleanState({...state,...patch});shown=9;plansShown=state.kind==='planned'?6:3;render();}
  function reset(){apply({q:'',category:'all',kind:'all',course:'all',city:'all',fresh:false,saved:false,sort:'curated'});}
  function detail(t){
    const cat=D.categories.find(c=>c.id===t.category);
    const courseLinks=t.collection==='Statistics Lab'?(t.courses||[]).filter(c=>['fundamentals','statistics'].includes(c)).map(c=>`<a href="course.html?course=${c==='fundamentals'?'fund-quant-methods':'quant-methods'}&amp;tab=lab&amp;labtool=${t.id}">${c==='fundamentals'?'Open in Fundamentals':'Open in Statistics'}</a>`).join(''):'';
    const source=t.kind==='external'&&D.safeHref(t.source,true)?`<p class="tk-detail-source"><a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">Provider information ${icon('external')}</a><br>Editorial review: <time datetime="${t.reviewed}">7 October 2026</time>. This is not a live check of access, price or availability.</p>`:'';
    return `<div class="tk-detail-top"><span class="tk-tool-symbol">${icon(t.icon)}</span><span class="tk-badge tk-badge-${t.kind}">${kinds[t.kind]}</span><span class="tk-meta">${cat.label}</span></div><h2 id="tk-detail-title">${esc(t.title)}</h2><p class="tk-detail-lead">${esc(t.summary)}</p><h3 class="tk-detail-heading">${t.kind==='planned'?'What it could include':'What you can use it for'}</h3><ul class="tk-detail-list">${t.includes.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p class="tk-detail-note${t.kind==='planned'?' is-planned':''}">${esc(t.note)}</p><p class="tk-meta"><strong>Access:</strong> ${esc(t.access)}</p>${courseLinks?`<div class="tk-detail-courses">${courseLinks}</div>`:''}<div class="tk-detail-actions">${t.kind==='planned'?'<a class="tk-button" href="contact.html">Discuss this idea '+icon('arrow-right')+'</a>':launch(t,t.kind==='external'?'Open provider site':'Open tool')}${saveButton(t)}<button type="button" id="tk-copy-link" class="tk-text-button">Copy entry link</button></div><div class="tk2-detail-actions"><button type="button" class="tk-button tk-button-outline" data-add-list="${t.id}">Add to a personal list</button>${t.kind!=='planned'?`<button type="button" class="tk-text-button" data-compare="${t.id}" aria-pressed="false">Compare this tool</button>`:''}</div>${source}<p class="tk-detail-source"><a href="contact.html">Suggest a correction or report a broken link</a></p><p id="tk-copy-status" class="tk-meta" role="status"></p><label id="tk-link-fallback" class="tk-meta" hidden>Copy this entry link<input id="tk-link-text" type="text" readonly></label>`;
  }
  function openDetail(id,opener){
    const t=D.byId.get(id);if(!t)return;
    activeTool=id;if(opener)lastOpener=opener;
    $('tk-detail-content').innerHTML=detail(t);
    if(!dialog.open){
      if(typeof dialog.showModal==='function')dialog.showModal();
      else{dialog.setAttribute('open','');dialog.setAttribute('role','dialog');}
    }
    root.dispatchEvent(new CustomEvent('toolkit:detail',{detail:{id}}));
    dialog.scrollTop=0;$('tk-detail-close').focus();syncURL();
  }
  function closeDetail(){
    if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
  }
  dialog.addEventListener('close',()=>{
    activeTool=null;syncURL();
    const target=lastOpener&&lastOpener.isConnected?lastOpener:$('tk-search');target.focus();
  });
  $('tk-detail-close').addEventListener('click',()=>{
    closeDetail();if(typeof dialog.close!=='function'){activeTool=null;syncURL();$('tk-search').focus();}
  });
  dialog.addEventListener('click',e=>{
    if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDetail();}
  });
  // The browser's native modal handles focus containment and Escape in supported browsers.
  dialog.addEventListener('keydown',e=>{
    if(typeof dialog.showModal==='function')return;
    if(e.key==='Escape'){$('tk-detail-close').click();e.preventDefault();return;}
    if(e.key!=='Tab')return;
    const focusable=[...dialog.querySelectorAll('a[href],button,input:not([hidden])')].filter(el=>!el.disabled&&el.getClientRects().length);
    const first=focusable[0],last=focusable.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  $('tk-categories').innerHTML=D.categories.map(c=>`<button type="button" class="tk-chip" data-category-filter="${c.id}" aria-pressed="false">${icon(c.icon)}${esc(c.label)}</button>`).join('');
  $('tk-search-form').addEventListener('submit',e=>{e.preventDefault();clearTimeout(queryTimer);apply({q:$('tk-search').value});});
  $('tk-search').addEventListener('input',()=>{clearTimeout(queryTimer);queryTimer=setTimeout(()=>apply({q:$('tk-search').value}),140);});
  for(const k of ['kind','course','sort','city'])$('tk-'+k).addEventListener('change',()=>apply({[k]:$('tk-'+k).value}));
  $('tk-fresh').addEventListener('change',()=>apply({fresh:$('tk-fresh').checked}));
  $('tk-grid').addEventListener('click',()=>apply({view:'grid'}));$('tk-list').addEventListener('click',()=>apply({view:'list'}));
  $('tk-all').addEventListener('click',()=>apply({saved:false}));$('tk-saved').addEventListener('click',()=>apply({saved:!state.saved}));
  $('tk-show-saved').addEventListener('click',()=>{apply({saved:true,q:'',category:'all',kind:'all',course:'all',city:'all',fresh:false});$('tk-results-heading').focus();});
  $('tk-reset').addEventListener('click',reset);$('tk-empty-reset').addEventListener('click',()=>{reset();$('tk-search').focus();});
  $('tk-find-calculators').addEventListener('click',()=>{apply({q:'Statistics Lab',category:'study',kind:'builtin',course:'all',city:'all',fresh:false,saved:false});$('tk-results-heading').focus();});
  $('tk-more').addEventListener('click',()=>{const previous=shown;shown+=9;render();const first=$('tk-results').children[previous];first?.querySelector('[data-save]')?.focus();});
  $('tk-more-plans').addEventListener('click',()=>{const previous=plansShown;plansShown+=6;render();$('tk-plans').children[previous]?.querySelector('[data-save]')?.focus();});
  $('tk-remember').addEventListener('change',()=>{prefs.rememberRecent=$('tk-remember').checked;if(!prefs.rememberRecent)prefs.recent=[];writePreferences();sidebar();});
  $('tk-clear-device').addEventListener('click',()=>{
    if(!window.confirm('Clear only Toolkit bookmarks and recently opened tools on this device? Your course progress and other Hub data will not be removed.'))return;
    prefs=D.cleanPreferences({});try{window.localStorage.removeItem(KEY);}catch(_){storageOK=false;}
    render();$('tk-feedback').textContent='Toolkit preferences cleared. Other Hub data were not changed.';
  });
  async function copyLink(){
    const link=urlFor(activeTool).href;
    try{if(!window.isSecureContext||!navigator.clipboard)throw new Error('Unavailable');await navigator.clipboard.writeText(link);$('tk-copy-status').textContent='Entry link copied. It does not include your saved or recent-tool list.';}
    catch(_){$('tk-link-fallback').hidden=false;$('tk-link-text').value=link;$('tk-link-text').focus();$('tk-link-text').select();$('tk-copy-status').textContent='Select and copy the link below.';}
  }
  function record(id){
    const t=D.byId.get(id);if(!prefs.rememberRecent||!t||t.kind==='planned')return;
    prefs.recent=[id,...prefs.recent.filter(x=>x!==id)].slice(0,6);writePreferences();sidebar();
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button,a');if(!b)return;
    if(b.hasAttribute('data-category-filter'))apply({category:b.dataset.categoryFilter});
    if(b.dataset.detail)openDetail(b.dataset.detail,b);
    if(b.dataset.save){
      const id=b.dataset.save;if(!D.byId.has(id))return;
      const wasSaved=prefs.saved.includes(id);prefs.saved=wasSaved?prefs.saved.filter(v=>v!==id):[...prefs.saved,id];
      writePreferences();const inDialog=dialog.contains(b);render();
      if(inDialog){b.setAttribute('aria-pressed',String(!wasSaved));b.setAttribute('aria-label',(!wasSaved?'Remove from saved: ':'Save to this device: ')+D.byId.get(id).title);b.focus();}
      else{const replacement=root.querySelector(`.tk-tool [data-save="${id}"]`);(replacement||$('tk-saved')).focus();}
      $('tk-feedback').textContent=D.byId.get(id).title+(wasSaved?' removed from your saved tools.':' saved on this device.');
    }
    if(b.dataset.launch)record(b.dataset.launch);
    if(b.id==='tk-copy-link')copyLink();
  });
  root.addEventListener('auxclick',e=>{if(e.button===1){const a=e.target.closest('[data-launch]');if(a)record(a.dataset.launch);}});
  window.addEventListener('storage',e=>{
    if(e.key!==KEY&&e.key!==null)return;
    try{prefs=D.cleanPreferences(JSON.parse(e.newValue||'{}'));}catch(_){prefs=D.cleanPreferences({});}
    render();if(activeTool)openDetail(activeTool);
  });
  window.addEventListener('popstate',()=>{
    state=readURL();const id=new URLSearchParams(window.location.search).get('tool');
    if(dialog.open&&!D.byId.has(id))closeDetail();render();if(D.byId.has(id))openDetail(id);
  });
  window.StudentToolkitUI=Object.freeze({apply,reset,openDetail,getSaved:()=>[...prefs.saved]});
  const requested=new URLSearchParams(window.location.search).get('tool');
  render();if(D.byId.has(requested))openDetail(requested);else if(requested){$('tk-feedback').textContent='That catalogue entry was not found. Showing the current catalogue.';syncURL();}
})();
