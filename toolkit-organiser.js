/* Toolkit v2 organiser. Native controls; no remote writes, telemetry or accounts.
 * Bookmarks remain owned by v1. Lists have a separate, explicit local storage key.
 */
(function(){
  'use strict';
  const D=window.StudentToolkitData,O=window.StudentToolkitOrganiser,U=window.StudentToolkitUI;
  const root=document.getElementById('toolkit-main');if(!D||!O||!U||!root)return;
  const $=id=>root.querySelector('#'+id);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<svg class="icon" aria-hidden="true"><use href="icons.svg#${esc(n)}"></use></svg>`;
  const KEY='euhem-toolkit-lists-v1',sections=['browse','solve','workbench','collections','lists','compare'];
  let store=O.cleanStore({}),storageOK=true,section='browse',selectedList=null,pack=null,compared=[],pendingTool=null,pendingImport=null,modalOpener=null;
  try{const raw=window.localStorage.getItem(KEY);if(raw)store=O.cleanStore(JSON.parse(raw));}catch(e){if(e instanceof SyntaxError)store=O.cleanStore({});else storageOK=false;}
  const makeId=()=>`l-${Date.now().toString(36)}-${window.crypto?.randomUUID?window.crypto.randomUUID():Math.random().toString(36).slice(2)}`;
  function message(text){$('tk2-status').textContent=text;$('tk2-error').hidden=true;}
  function fail(e){$('tk2-error').textContent=e.message||String(e);$('tk2-error').hidden=false;if(modal.open){$('tk2-modal-status').textContent=e.message||String(e);}if($('tk-dialog').open&&$('tk-copy-status'))$('tk-copy-status').textContent=e.message||String(e);}
  function persist(next){store=O.cleanStore(next);try{window.localStorage.setItem(KEY,JSON.stringify(store));}catch(_){storageOK=false;}$('tk2-storage-warning').hidden=storageOK;}
  function run(action){try{action();}catch(e){fail(e);}}
  const kind=t=>t.kind==='planned'?'Planned · not available':t.kind==='builtin'?'Built-in / Hub':'External provider';
  const chip=t=>`<span class="tk-badge tk-badge-${t.kind}">${esc(kind(t))}</span>`;
  function itemLink(t,label='Open'){
    if(t.kind==='planned')return `<button type="button" class="tk-text-button" data-detail="${t.id}">Read the plan</button>`;
    if(!D.safeHref(t.href,t.kind==='external'))return '';
    return `<a class="tk-text-link" href="${esc(t.href)}" data-launch="${t.id}"${t.kind==='external'?' target="_blank" rel="noopener noreferrer"':''}>${esc(label)} ${icon(t.kind==='external'?'external':'arrow-right')}</a>`;
  }
  function writeURL(){
    const url=new URL(window.location.href);
    if(section==='browse')url.searchParams.delete('section');else url.searchParams.set('section',section);
    if(section==='collections'&&pack)url.searchParams.set('collection',pack);else url.searchParams.delete('collection');
    if(section!=='workbench')url.searchParams.delete('planner');
    try{history.replaceState(null,'',url.href);}catch(_){/* previews may disallow history writes */}
  }
  function show(next,focus=false){
    section=sections.includes(next)?next:'browse';
    for(const key of sections){$('tk2-'+key).hidden=key!==section;root.querySelector(`[data-section="${key}"]`).setAttribute('aria-pressed',String(key===section));}
    if(section==='collections')renderCollections();if(section==='lists')renderLists();if(section==='compare')renderCompare();
    writeURL();root.dispatchEvent(new CustomEvent('toolkit:section',{detail:{section}}));if(focus){const title=section==='browse'?$('tk-results-heading'):$('tk2-'+section+'-title');title?.focus();}
  }
  function renderCollections(){
    $('tk2-collections').innerHTML=`<div class="tk2-heading"><div><p class="tk-eyebrow">START WITH A GOAL, NOT A LONG DIRECTORY</p><h2 id="tk2-collections-title" tabindex="-1">A useful set. A clear next step.</h2><p class="tk-meta">Eight editorial collections, each with four suggested steps. Choose what fits your task; these are not official course requirements.</p></div><span class="tk2-pill">8 collections</span></div><div class="tk2-pack-grid">${O.collections.map(c=>`<article class="tk2-pack" data-pack-card="${c.id}"><div class="tk2-pack-top"><span class="tk-tool-symbol">${icon(c.icon)}</span><span class="tk-meta tk-small">${esc(c.category)}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><div class="tk2-pack-bottom"><span>${c.items.length} entries · 4 steps</span><button type="button" class="tk-text-button" data-pack="${c.id}" aria-expanded="${pack===c.id}" aria-controls="tk2-pack-detail">Explore collection →</button></div></article>`).join('')}</div><div id="tk2-pack-detail"></div>`;
    const c=O.packs.get(pack);if(!c)return;
    $('tk2-pack-detail').innerHTML=`<section class="tk2-pack-detail"><div class="tk2-heading"><div><p class="tk-eyebrow">YOUR SUGGESTED ROUTE</p><h3 id="tk2-pack-title" tabindex="-1">${esc(c.title)}</h3><p class="tk-meta">${esc(c.summary)}</p></div><div class="tk2-inline-actions"><button type="button" class="tk-button" data-copy-pack="${c.id}">Use as a personal list</button><button type="button" class="tk-text-button" id="tk2-share-pack">Copy collection link</button></div></div><ol class="tk2-steps">${c.steps.map(([title,text,tools],i)=>`<li><span class="tk2-step-number">0${i+1}</span><div><h4>${esc(title)}</h4><p>${esc(text)}</p><div class="tk2-step-tools">${tools.map(id=>`<button type="button" data-detail="${id}">${esc(D.byId.get(id).title)} ${icon('arrow-right')}</button>`).join('')}</div></div></li>`).join('')}</ol><p class="tk-meta tk-small">Each tool keeps its own access rules. Copying this collection does not create provider accounts, subscribe to alerts or perform these steps for you.</p></section>`;
  }
  function renderLists(){
    if(!store.lists.some(l=>l.id===selectedList))selectedList=store.lists[0]?.id||null;
    const list=store.lists.find(l=>l.id===selectedList);
    $('tk2-lists').innerHTML=`<div class="tk2-heading"><div><p class="tk-eyebrow">YOUR WORKFLOW, YOUR ORDER</p><h2 id="tk2-lists-title" tabindex="-1">Make room for your useful finds.</h2><p class="tk-meta">Name a shortlist, add catalogue entries and mark the ones you have reviewed. Saved on this device only — no login or cloud sync.</p></div><span class="tk2-pill">${store.lists.length} / 12 lists</span></div><div class="tk2-my-layout"><aside class="tk2-my-sidebar"><form id="tk2-create-form"><label class="tk2-label" for="tk2-list-name">New list name</label><input id="tk2-list-name" maxlength="60" placeholder="e.g. My thesis toolkit" required autocomplete="off"><button class="tk-button" type="submit">Create list ${icon('plus')}</button></form><div class="tk2-my-nav" role="group" aria-label="Your lists">${store.lists.map(l=>`<button type="button" data-list="${l.id}" aria-pressed="${l.id===selectedList}"><span>${esc(l.title)}</span><small>${l.items.length} entries</small></button>`).join('')||'<p class="tk-meta">No lists yet. Start empty or copy a ready-made collection.</p>'}</div><button type="button" class="tk-text-button" id="tk2-from-saved">Create a list from saved tools</button><div class="tk2-backups"><h3>Keep a portable copy.</h3><p>JSON backups contain list names, tool IDs and reviewed checkboxes. They do not contain your course progress or recent history.</p><button type="button" class="tk-text-button" id="tk2-export" ${store.lists.length?'':'disabled'}>Export lists (.json)</button><label for="tk2-import-file" class="tk2-label">Import a Toolkit backup</label><input id="tk2-import-file" type="file" accept=".json,application/json"><button type="button" class="tk-text-button" id="tk2-clear-lists" ${store.lists.length?'':'disabled'}>Clear my lists</button></div></aside><div class="tk2-list-editor">${list?listEditor(list):`<div class="tk2-list-empty">${icon('bookmark')}<h3>A shortlist for your next task.</h3><p>Create a list such as “Statistics revision” or “Moving to Oslo”. Add tools from their cards, or start from a collection.</p><button type="button" class="tk-button" data-section="collections">Explore ready-made collections →</button></div>`}</div></div>`;
    $('tk2-create-form').addEventListener('submit',e=>{e.preventDefault();run(()=>createList($('tk2-list-name').value,[]));});
    if(list){$('tk2-rename-form').addEventListener('submit',e=>{e.preventDefault();run(()=>{persist(O.changeList(store,list.id,'rename',$('tk2-rename-name').value));renderLists();$('tk2-rename-name').focus();message('List renamed.');});});
      $('tk2-add-form').addEventListener('submit',e=>{e.preventDefault();run(()=>{const id=$('tk2-add-choice').value;if(!id)throw new Error('Choose an entry to add.');persist(O.changeList(store,list.id,'add',id));renderLists();$('tk2-add-choice').focus();message('Entry added to your list.');});});}
    $('tk2-import-file').addEventListener('change',e=>run(()=>importFile(e.target.files?.[0])));
  }
  function listEditor(l){
    return `<div class="tk2-list-title"><p class="tk-eyebrow">PERSONAL LIST · LOCAL ONLY</p><h3>${esc(l.title)}</h3><p class="tk-meta">${l.checked.length} / ${l.items.length} entries reviewed. This is your checklist, not a course grade or a claim that a planned tool is available.</p><progress max="${Math.max(1,l.items.length)}" value="${l.checked.length}" aria-label="Entries reviewed"></progress></div><div class="tk2-list-settings"><form id="tk2-rename-form"><label for="tk2-rename-name" class="tk2-label">Rename this list</label><div><input id="tk2-rename-name" maxlength="60" value="${esc(l.title)}" required><button class="tk-text-button" type="submit">Save name</button></div></form><button type="button" class="tk-text-button" data-delete-list="${l.id}">Delete list</button></div><form id="tk2-add-form" class="tk2-add-form"><label class="tk2-label" for="tk2-add-choice">Add an entry (${l.items.length} / 30)</label><div><select id="tk2-add-choice"><option value="">Choose a tool or planned idea…</option>${D.items.filter(t=>!l.items.includes(t.id)).slice().sort((a,b)=>a.title.localeCompare(b.title,'en')).map(t=>`<option value="${t.id}">${esc(t.title)}${t.kind==='planned'?' [Planned]':''}</option>`).join('')}</select><button type="submit" class="tk-button" ${l.items.length>=30?'disabled':''}>Add</button></div></form><ol class="tk2-list-entries">${l.items.map((id,i)=>{const t=D.byId.get(id);return `<li data-entry="${id}"><label class="tk2-review-check"><input type="checkbox" data-reviewed="${id}" ${l.checked.includes(id)?'checked':''} aria-label="Mark ${esc(t.title)} reviewed"><span class="tk-sr-only">Reviewed</span></label><div class="tk2-entry-copy">${chip(t)}<h4>${esc(t.title)}</h4><p>${esc(t.summary)}</p><div class="tk2-inline-actions">${itemLink(t)}<button class="tk-text-button" type="button" data-detail="${id}">Details</button></div></div><div class="tk2-entry-controls"><button type="button" data-move="up" data-item="${id}" class="tk-icon-button" aria-label="Move ${esc(t.title)} up" ${i===0?'disabled':''}>↑</button><button type="button" data-move="down" data-item="${id}" class="tk-icon-button" aria-label="Move ${esc(t.title)} down" ${i===l.items.length-1?'disabled':''}>↓</button><button type="button" data-remove-entry="${id}" class="tk-icon-button" aria-label="Remove ${esc(t.title)}">${icon('close')}</button></div></li>`;}).join('')||'<li class="tk-meta">Your list is empty. Choose an entry above.</li>'}</ol>`;
  }
  function createList(name,items){const id=makeId();persist(O.newList(store,name,items,id));selectedList=id;show('lists');$('tk2-lists-title').focus();message('List created on this device.');return id;}
  function compareButtonState(){
    root.querySelectorAll('[data-compare]').forEach(b=>{const yes=compared.includes(b.dataset.compare);b.setAttribute('aria-pressed',String(yes));b.textContent=yes?'Selected ✓':'Compare';});
    $('tk2-compare-count').textContent=compared.length;
  }
  function renderCompare(){
    const rows=[['Type',t=>kind(t)],['Useful for',t=>t.summary],['Possible uses',t=>t.includes.join('\n')],['Access',t=>t.access],['Limitations to check',t=>t.note],['Course connection',t=>(t.courses||[]).map(c=>D.courseLabels[c]||c).join(' · ')||'Not course-specific'],['Source review',t=>t.reviewed?'Provider description reviewed '+t.reviewed:'Existing Hub workspace']];
    $('tk2-compare').innerHTML=`<div class="tk2-heading"><div><p class="tk-eyebrow">A SIDE-BY-SIDE LOOK, NOT A RANKING</p><h2 id="tk2-compare-title" tabindex="-1">Choose what fits your task.</h2><p class="tk-meta">Compare up to three available entries. Provider details are editorial snapshots, not live prices, quality scores or endorsements. Planned ideas cannot be compared as working tools.</p></div><button type="button" class="tk-text-button" id="tk2-clear-compare">Clear comparison</button></div><div class="tk2-compare-add"><label class="tk2-label" for="tk2-compare-choice">Add an available entry</label><select id="tk2-compare-choice"><option value="">Choose a tool…</option>${D.items.filter(t=>t.kind!=='planned'&&!compared.includes(t.id)).map(t=>`<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select><button type="button" class="tk-button" id="tk2-add-compare" ${compared.length>=3?'disabled':''}>Add to comparison</button></div>${compared.length?`<div class="tk2-compare-scroll" role="region" tabindex="0" aria-label="Scrollable tool comparison"><table class="tk2-compare-table"><caption>Practical comparison of ${compared.length} selected entries</caption><thead><tr><th scope="col">What matters</th>${compared.map(id=>{const t=D.byId.get(id);return `<th scope="col"><h3>${esc(t.title)}</h3>${itemLink(t)}<button type="button" class="tk-text-button" data-compare="${id}" aria-pressed="true">Remove from comparison</button></th>`;}).join('')}</tr></thead><tbody>${rows.map(([label,get])=>`<tr><th scope="row">${label}</th>${compared.map(id=>`<td>${esc(get(D.byId.get(id)))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="tk2-list-empty"><h3>Start with two tools you are considering.</h3><p>Use Compare on a card, in its details, or choose an available entry above. Your selection stays only for this page session.</p><button type="button" class="tk-button" data-section="browse">Back to the catalogue →</button></div>'}`;
  }
  function toggleCompare(id){
    if(!D.byId.has(id)||D.byId.get(id).kind==='planned')throw new Error('Choose an available tool to compare.');
    const exists=compared.includes(id);if(!exists&&compared.length>=3)throw new Error('Compare up to three tools. Remove one before adding another.');
    compared=exists?compared.filter(x=>x!==id):[...compared,id];compareButtonState();if(section==='compare')renderCompare();message(`${compared.length} selected for comparison. Selections are not saved between page sessions.`);
    const status=root.querySelector('#tk-copy-status');if($('tk-dialog').open&&status)status.textContent=`${compared.length} selected. Open the Compare section after closing these details.`;
  }
  const modal=document.createElement('dialog');modal.id='tk2-modal';modal.className='tk2-modal';modal.setAttribute('aria-labelledby','tk2-modal-title');
  modal.innerHTML='<button type="button" id="tk2-modal-close" class="tk-icon-button tk2-modal-close" aria-label="Close">×</button><div id="tk2-modal-content"></div><p id="tk2-modal-status" role="status"></p>';
  root.appendChild(modal);
  function openModal(html,opener){modalOpener=opener||document.activeElement;$('tk2-modal-content').innerHTML=html;$('tk2-modal-status').textContent='';if(!modal.open){if(modal.showModal)modal.showModal();else modal.setAttribute('open','');}$('tk2-modal-close').focus();}
  function closeModal(){if(modal.close)modal.close();else{modal.removeAttribute('open');modalOpener?.focus();}}
  modal.addEventListener('close',()=>{if(modalOpener?.isConnected)modalOpener.focus();else root.querySelector(`[data-section="${section}"]`).focus();});
  $('tk2-modal-close').addEventListener('click',closeModal);
  modal.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'&&!modal.showModal){const nodes=[...modal.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled&&el.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  function chooseList(id,opener){
    if(!D.byId.has(id))return;pendingTool=id;
    openModal(`<p class="tk-eyebrow">SAVE IT IN CONTEXT</p><h2 id="tk2-modal-title">Add ${esc(D.byId.get(id).title)} to a list.</h2>${store.lists.length?`<form id="tk2-picker-form"><label class="tk2-label" for="tk2-picker">Choose a list</label><select id="tk2-picker">${store.lists.map(l=>`<option value="${l.id}">${esc(l.title)} (${l.items.length}/30)</option>`).join('')}</select><button type="submit" class="tk-button">Add to this list</button></form>`:''}<form id="tk2-quick-create"><label class="tk2-label" for="tk2-quick-name">Or create a new list</label><input id="tk2-quick-name" maxlength="60" required placeholder="e.g. Statistics revision"><button type="submit" class="tk-button tk-button-outline">Create list &amp; add</button></form><p class="tk-meta tk-small">Saved on this device only. This does not change the tool's availability.</p>`,opener);
    $('tk2-picker-form')?.addEventListener('submit',e=>{e.preventDefault();run(()=>{persist(O.changeList(store,$('tk2-picker').value,'add',pendingTool));if(section==='lists')renderLists();closeModal();message('Entry added to your personal list.');});});
    $('tk2-quick-create').addEventListener('submit',e=>{e.preventDefault();run(()=>{const id=makeId();persist(O.newList(store,$('tk2-quick-name').value,[pendingTool],id));selectedList=id;if(section==='lists')renderLists();closeModal();message('New list created. Find it in My lists.');});});
  }
  async function copyText(text){try{if(!navigator.clipboard||!window.isSecureContext)throw new Error();await navigator.clipboard.writeText(text);message('Collection link copied. It contains no personal lists or progress.');}catch(_){openModal('<h2 id="tk2-modal-title">Copy this collection link</h2><label class="tk2-label" for="tk2-link-text">Select and copy</label><textarea id="tk2-link-text" rows="4" readonly></textarea>');$('tk2-link-text').value=text;$('tk2-link-text').focus();$('tk2-link-text').select();}}
  function downloadLists(){
    const text=O.exportStore(store),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='euhem-toolkit-lists.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Backup prepared. It includes list names and reviewed entries; keep it private as appropriate.');
  }
  async function importFile(file){
    if(!file)return;
    try{if(file.size>O.LIMITS.bytes)throw new Error('Choose a JSON backup smaller than 100 KB.');pendingImport=O.parseImport(await file.text());if(store.lists.length+pendingImport.length>12)throw new Error('Import would exceed 12 lists. No lists were changed.');
      openModal(`<p class="tk-eyebrow">REVIEW BEFORE IMPORTING</p><h2 id="tk2-modal-title">Add ${pendingImport.length} lists?</h2><p class="tk-meta">Existing lists will stay unchanged. Each imported list receives a new local ID; repeated imports create additional copies.</p><ul class="tk2-import-preview">${pendingImport.map(l=>`<li>${esc(l.title)} <span>${l.items.length} entries</span></li>`).join('')}</ul><button type="button" class="tk-button" id="tk2-confirm-import">Confirm import</button>`);
      $('tk2-confirm-import').addEventListener('click',()=>run(()=>{persist(O.mergeImport(store,pendingImport,makeId));pendingImport=null;renderLists();closeModal();message('Backup imported without replacing existing lists.');}));
    }catch(e){fail(e);}finally{if($('tk2-import-file'))$('tk2-import-file').value='';}
  }
  root.addEventListener('click',e=>{
    if(e.target.closest('a[href="#tk-library"]'))show('browse');
    const b=e.target.closest('button');if(!b)return;
    run(()=>{
      if(b.dataset.section)show(b.dataset.section,true);
      if(b.dataset.pack){pack=b.dataset.pack;renderCollections();writeURL();$('tk2-pack-title').focus();}
      if(b.dataset.copyPack){const c=O.packs.get(b.dataset.copyPack);if(c)createList(c.title,c.items);}
      if(b.dataset.list){selectedList=b.dataset.list;renderLists();$('tk2-rename-name')?.focus();}
      if(b.dataset.addList)chooseList(b.dataset.addList,b);
      if(b.dataset.compare)toggleCompare(b.dataset.compare);
      if(b.dataset.deleteList&&window.confirm('Delete this list only? Other lists, bookmarks and course progress will remain.')){persist(O.changeList(store,b.dataset.deleteList,'delete'));renderLists();$('tk2-list-name').focus();message('List deleted.');}
      if(b.dataset.removeEntry){persist(O.changeList(store,selectedList,'remove',b.dataset.removeEntry));renderLists();$('tk2-add-choice')?.focus();message('Entry removed from this list.');}
      if(b.dataset.move){persist(O.changeList(store,selectedList,b.dataset.move,b.dataset.item));renderLists();const item=root.querySelector(`[data-entry="${b.dataset.item}"]`);(item?.querySelector(`[data-move="${b.dataset.move}"]:not(:disabled)`)||item?.querySelector('[data-reviewed]'))?.focus();}
      if(b.id==='tk2-from-saved'){const saved=U.getSaved();if(!saved.length)throw new Error('Save a tool first, or create an empty list.');createList('My saved tools',saved);if(saved.length>30)message('A new list was created with the first 30 saved entries. Your saved tools are unchanged.');}
      if(b.id==='tk2-export')downloadLists();
      if(b.id==='tk2-clear-lists'&&window.confirm('Clear all Toolkit personal lists on this device? Bookmarks, recent history and course progress will not be changed.')){store=O.cleanStore({});try{window.localStorage.removeItem(KEY);}catch(_){storageOK=false;}renderLists();$('tk2-list-name').focus();message('Personal lists cleared. Other Hub data were not changed.');}
      if(b.id==='tk2-add-compare'){const id=$('tk2-compare-choice').value;if(id)toggleCompare(id);else throw new Error('Choose an available entry first.');}
      if(b.id==='tk2-clear-compare'){compared=[];renderCompare();compareButtonState();message('Comparison cleared.');}
      if(b.id==='tk2-new-resources'){show('browse');U.reset();U.apply({fresh:true});$('tk-results-heading').focus();}
      if(b.id==='tk2-share-pack'){const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('section','collections');url.searchParams.set('collection',pack);copyText(url.href);}
    });
  });
  root.addEventListener('change',e=>{if(e.target.dataset.reviewed)run(()=>{const id=e.target.dataset.reviewed;persist(O.changeList(store,selectedList,'check',id));renderLists();root.querySelector(`[data-reviewed="${id}"]`)?.focus();message('Your reviewed checklist was updated.');});});
  root.addEventListener('toolkit:render',compareButtonState);root.addEventListener('toolkit:detail',compareButtonState);
  window.addEventListener('storage',e=>{if(e.key!==KEY&&e.key!==null)return;try{store=O.cleanStore(JSON.parse(e.newValue||'{}'));}catch(_){store=O.cleanStore({});}if(section==='lists')renderLists();if(modal.open&&$('tk2-picker-form'))closeModal();});
  function fromURL(){const p=new URLSearchParams(window.location.search);pack=O.packs.has(p.get('collection'))?p.get('collection'):null;show(p.get('section')||'browse');}
  window.addEventListener('popstate',fromURL);$('tk2-storage-warning').hidden=storageOK;fromURL();compareButtonState();
})();
