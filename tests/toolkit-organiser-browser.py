"""Browser regression of actual Student Toolkit sources in an inline sandbox.
This fallback harness adapts location/history, localStorage and local fetch because
this execution environment blocks browser network navigation, including localhost.
It does NOT test the deployed site's network, real persistent storage or service worker.
Run: EUHEM_SITE_ROOT=/path/to/site EUHEM_TEST_OUTPUT=/path/out python tests/toolkit-browser.py
Requires Python Playwright and Chromium. Font bytes are loaded locally for rendering,
not copied into the handoff archive.
"""
from pathlib import Path
import os,re,json,base64,mimetypes
from playwright.sync_api import sync_playwright
ROOT=Path(os.getenv('EUHEM_SITE_ROOT',str(Path(__file__).resolve().parents[1])))
OUT=Path(os.getenv('EUHEM_TEST_OUTPUT','/mnt/data/toolkit-work')); OUT.mkdir(exist_ok=True,parents=True)
(OUT/'screenshots').mkdir(exist_ok=True)
checks=[]
def ok(label,condition):
    assert condition,label
    checks.append(label); print('PASS',label,flush=True)
def adapted(code):
    code=code.replace('window.location.','window.__loc.')
    return re.sub(r'(?<![\w.])location\.', 'window.__loc.',code)
def dataURL(p):
    return 'data:'+ (mimetypes.guess_type(p)[0] or 'application/octet-stream')+';base64,'+base64.b64encode(p.read_bytes()).decode()
def inlineCSS(css):
    def replace(m):
        path=ROOT/m.group(2).split('?')[0]
        return f'url("{dataURL(path)}")' if path.is_file() else m.group(0)
    return re.sub(r'url\(([\"\']?)([^\)\"\']+)\1\)',replace,css)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    def load(path='toolkit.html',query='',width=1365,storage=None,blocked=False):
        ctx=browser.new_context(viewport={'width':width,'height':1000},reduced_motion='reduce')
        page=ctx.new_page();page.set_default_timeout(9000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        html=(ROOT/path).read_text()
        styles=re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"',html)
        scripts=re.findall(r'<script[^>]+src="([^"]+)"',html)
        page.set_content(re.sub(r'<script[\s\S]*?</script>|<link[^>]+>','',html))
        files={str(p.relative_to(ROOT)):p.read_text() for folders in ['content','data','calendar'] for p in (ROOT/folders).rglob('*') if p.is_file() and p.suffix in ['.json','.md','.csv','.html','.txt','.ics']}
        js={p.name:adapted(p.read_text()) for p in ROOT.glob('*.js')}
        page.evaluate('''({url,files,js,storage,blocked})=>{
          const update=u=>{const v=new URL(u);for(const k of ['href','search','hash','pathname','origin','host','protocol'])window.__loc[k]=v[k];};
          window.__loc={};update(url); window.__loc.reload=()=>{};
          window.__loc.assign=u=>update(new URL(u,window.__loc.href).href);window.__loc.replace=window.__loc.assign;
          window.__prefs={...storage};
          const ls={getItem:k=>{if(blocked)throw new Error('Storage denied in test');return window.__prefs[k]??null;},setItem:(k,v)=>{if(blocked)throw new Error('Storage denied in test');window.__prefs[k]=String(v);},removeItem:k=>{if(blocked)throw new Error('Storage denied in test');delete window.__prefs[k];},clear:()=>{throw new Error('Do not clear unrelated site data');}};
          Object.defineProperty(window,'localStorage',{configurable:true,value:ls});
          const stack=[url];let pos=0;
          history.replaceState=(_s,_t,u)=>{update(new URL(u,window.__loc.href).href);stack[pos]=window.__loc.href;};
          history.pushState=(_s,_t,u)=>{update(new URL(u,window.__loc.href).href);stack.splice(++pos);stack.push(window.__loc.href);};
          window.__go=u=>{update(new URL(u,window.__loc.href).href);window.dispatchEvent(new PopStateEvent('popstate'));};
          window.__back=()=>{pos=Math.max(0,pos-1);update(stack[pos]);window.dispatchEvent(new PopStateEvent('popstate'));};
          window.__hash=h=>{update(new URL(h,window.__loc.href).href);window.dispatchEvent(new HashChangeEvent('hashchange'));};
          document.addEventListener('click',e=>{const a=e.target.closest('a[href]');if(a){e.preventDefault();window.__lastLink=a.getAttribute('href');if(a.getAttribute('href').startsWith('#'))window.__hash(a.getAttribute('href'));}},true);
          window.fetch=async input=>{const u=new URL(typeof input==='string'?input:input.url,window.__loc.href),p=u.pathname.replace(/^\\//,'');if(u.origin!=='https://toolkit.example')throw new Error('External fetch disabled in inline harness');return new Response(files[p]??'',{status:p in files?200:404});};
          window.__scripts=js;
          const append=document.head.appendChild.bind(document.head);
          document.head.appendChild=node=>{if(node.tagName==='SCRIPT'&&node.src){const path=new URL(node.src,window.__loc.href).pathname.split('/').pop();if(js[path]){const script=document.createElement('script');script.textContent=js[path];append(script);queueMicrotask(()=>node.dispatchEvent(new Event('load')));return node;}queueMicrotask(()=>node.dispatchEvent(new Event('error')));return node;}return append(node);};
        }''',{'url':'https://toolkit.example/'+path+query,'files':files,'js':js,'storage':storage or {},'blocked':blocked})
        for href in styles:
            if not href.startswith('http') and (ROOT/href.split('?')[0]).is_file():page.add_style_tag(content=inlineCSS((ROOT/href.split('?')[0]).read_text()))
        sprite=(ROOT/'icons.svg').read_text()
        page.evaluate('''sprite=>{const box=document.createElement('div');box.hidden=true;box.innerHTML=sprite;document.body.prepend(box);const fix=()=>document.querySelectorAll('use[href^="icons.svg#"]').forEach(el=>el.setAttribute('href',el.getAttribute('href').replace('icons.svg','')));new MutationObserver(fix).observe(document.body,{childList:true,subtree:true});fix();}''',sprite)
        for img in page.locator('img[src]').all():
            p=ROOT/(img.get_attribute('src')or'').split('?')[0]
            if p.is_file():img.evaluate('(el,src)=>{el.removeAttribute("srcset");el.src=src;}',dataURL(p))
        # In a real page theme.js runs in <head> while readyState is loading,
        # so its toggle mounts after site-nav. Simulate that order after set_content.
        ordered=[src for src in scripts if not src.startswith('theme.js')];
        nav_index=next((i for i,s in enumerate(ordered) if s.startswith('site-nav.js')),-1)
        ordered[nav_index+1:nav_index+1]=[src for src in scripts if src.startswith('theme.js')]
        for src in ordered:
            p=ROOT/src.split('?')[0]
            if not src.startswith('http') and p.is_file() and p.name!='pwa.js':page.add_script_tag(content=js[p.name])
        page.wait_for_timeout(400)
        page.evaluate('document.fonts.ready');return ctx,page,errors
    ctx,p,errors=load()
    def section(name):p.locator('#tk2-sections [data-section="'+name+'"]').click()
    ok('six toolkit sections',p.locator('#tk2-sections button').count()==6)
    ok('64 available and 6 plans separate',p.locator('#tk-available-count').inner_text()=='64' and p.locator('#tk-planned-count').inner_text()=='6')
    ok('no personal lists automatically saved',p.evaluate('!window.__prefs["euhem-toolkit-lists-v1"]'))
    p.locator('#tk2-new-resources').click()
    ok('new resources shortcut shows 12 available additions',p.locator('#tk-available-count').inner_text()=='12' and p.locator('#tk-fresh').is_checked())
    p.locator('#tk-city').select_option('oslo')
    ok('city and fresh combine',p.locator('#tk-available-count').inner_text()=='2')
    ok('city filter propagated into URL',p.evaluate('window.__loc.search.includes("city=oslo")'))
    p.locator('#tk-reset').click()
    section('collections')
    ok('8 collection cards',p.locator('.tk2-pack').count()==8)
    ok('catalogue hidden in collection view',not p.locator('#tk2-browse').is_visible())
    p.locator('[data-pack="literature-review"]').click()
    ok('collection has 4 ordered steps',p.locator('.tk2-steps > li').count()==4)
    ok('collection details have source tools',p.locator('.tk2-steps [data-detail="equator"]').count()==1)
    ok('collection URL includes stable ID',p.evaluate('window.__loc.search.includes("collection=literature-review")'))
    p.locator('#tk2-share-pack').click()
    ok('share fallback modal opens',p.locator('#tk2-modal').is_visible())
    shared=p.locator('#tk2-link-text').input_value()
    ok('collection link excludes personal values', 'collection=literature-review' in shared and 'lists=' not in shared)
    p.keyboard.press('Escape')
    ok('Escape restores share button focus',p.evaluate('document.activeElement.id')=='tk2-share-pack')
    p.locator('.tk2-steps [data-detail="zotero"]').click()
    ok('existing details work inside collection',p.locator('#tk-detail-title').inner_text()=='Zotero')
    p.locator('[data-add-list="zotero"]').filter(visible=True).last.click() if False else p.locator('#tk-dialog [data-add-list="zotero"]').click()
    ok('add-to-list can open over tool details',p.locator('#tk2-modal').is_visible() and p.locator('#tk-dialog').is_visible())
    p.locator('#tk2-quick-name').fill('Research shortlist')
    p.locator('#tk2-quick-create button').click()
    ok('quick create persists one chosen entry',p.evaluate('JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists[0].items.join(",")')=='zotero')
    p.keyboard.press('Escape')
    p.locator('[data-copy-pack="literature-review"]').click()
    ok('copy collection creates second personal list',p.locator('.tk2-my-nav [data-list]').count()==2)
    ok('copied collection has seven items',p.locator('.tk2-list-entries [data-entry]').count()==7)
    ok('copied collection not premarked as reviewed',p.locator('.tk2-list-entries input:checked').count()==0)
    p.locator('[data-reviewed="thesis"]').check()
    ok('review flag persists',p.evaluate('JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists[1].checked.includes("thesis")'))
    p.locator('[data-move="down"][data-item="thesis"]').click()
    ok('list reorder persists',p.evaluate('JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists[1].items[1]')=='thesis')
    p.locator('#tk2-rename-name').fill('<img src=x onerror=alert(1)>')
    p.locator('#tk2-rename-form button').click()
    ok('list title safely rendered as literal text',p.locator('.tk2-list-title h3').inner_text()=='<img src=x onerror=alert(1)>')
    ok('malicious list title creates no img',p.locator('.tk2-list-title img').count()==0)
    p.locator('#tk2-rename-name').fill('My thesis toolkit');p.locator('#tk2-rename-form button').click()
    p.locator('#tk2-add-choice').select_option('four-city-budget');p.locator('#tk2-add-form button').click()
    ok('promoted budget keeps its old list ID and becomes available','not available' not in p.locator('[data-entry="four-city-budget"] .tk-badge').inner_text())
    ok('promoted budget opens Workbench from personal list','section=workbench&planner=four-city-budget' in p.locator('[data-entry="four-city-budget"] a[data-launch]').get_attribute('href'))
    p.locator('[data-remove-entry="four-city-budget"]').click()
    p.locator('#tk2-add-choice').select_option('travel-budget');p.locator('#tk2-add-form button').click()
    ok('remaining planned entry cannot launch',p.locator('[data-entry="travel-budget"] a[data-launch]').count()==0 and 'not available' in p.locator('[data-entry="travel-budget"] .tk-badge').inner_text())
    p.locator('[data-remove-entry="travel-budget"]').click()
    ok('removing entry affects current list only',p.evaluate('JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists[0].items.join(",")')=='zotero')
    p.evaluate('window.__prefs["other-progress"]="keep";window.URL.createObjectURL=(blob)=>{window.__exported=blob;return "blob:https://toolkit.example/backup"};window.URL.revokeObjectURL=()=>{};')
    p.locator('#tk2-export').click()
    exported=p.evaluate('window.__exported.text()')
    parsed=json.loads(exported)
    ok('JSON export contains lists and reviewed flags',parsed['format']=='euhem-toolkit-lists' and len(parsed['lists'])==2)
    ok('export excludes unrelated course keys','other-progress' not in exported and 'rememberRecent' not in exported)
    p.locator('#tk2-import-file').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':exported.encode()})
    ok('import requires confirmation',p.locator('#tk2-confirm-import').is_visible() and len(p.evaluate('JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists'))==2)
    p.locator('#tk2-confirm-import').click()
    ok('import preserves two existing lists and adds two',p.locator('.tk2-my-nav [data-list]').count()==4)
    ok('imported lists have unique IDs',p.evaluate('(()=>{let a=JSON.parse(__prefs["euhem-toolkit-lists-v1"]).lists;return new Set(a.map(x=>x.id)).size===4})()'))
    p.locator('#tk2-import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"format":"evil"}'})
    p.locator('#tk2-error').wait_for(state='visible')
    ok('invalid import shows error and changes no lists',p.locator('#tk2-error').is_visible() and p.locator('.tk2-my-nav [data-list]').count()==4)
    # Comparison is session-only and excludes planned entries.
    section('browse');p.locator('#tk-reset').evaluate('(b)=>b.click()')
    for id in ['normal','descriptive','zotero']:
        p.evaluate('(id)=>window.StudentToolkitUI.openDetail(id)',id)
        p.locator('#tk-dialog [data-compare="'+id+'"]').click();p.keyboard.press('Escape')
    ok('3 selected for comparison',p.locator('#tk2-compare-count').inner_text()=='3')
    p.evaluate('window.StudentToolkitUI.openDetail("jamovi")');p.locator('#tk-dialog [data-compare="jamovi"]').click()
    ok('fourth comparison rejected',p.locator('#tk2-compare-count').inner_text()=='3' and 'three' in p.locator('#tk2-error').inner_text())
    p.keyboard.press('Escape');section('compare')
    ok('comparison table has 3 selected tools',p.locator('.tk2-compare-table thead th').count()==4)
    ok('comparison includes limitations not ratings','Limitations to check' in p.locator('.tk2-compare-table').inner_text() and 'rating' not in p.locator('.tk2-compare-table').inner_text().lower())
    p.locator('#tk2-clear-compare').click()
    ok('clear comparison empties selection',p.locator('#tk2-compare-count').inner_text()=='0')
    p.locator('#tk2-compare-choice').select_option('zotero');p.locator('#tk2-add-compare').click()
    ok('direct compare picker works',p.locator('#tk2-compare-count').inner_text()=='1')
    ok('remaining planned idea absent from compare picker',p.locator('#tk2-compare-choice option[value="travel-budget"]').count()==0)
    ok('promoted budget present in compare picker',p.locator('#tk2-compare-choice option[value="four-city-budget"]').count()==1)
    saved_state=p.evaluate('window.__prefs')
    ok('no comparison state persisted',all('compare' not in k for k in saved_state))
    ok('main interactions no JS exceptions',errors==[])
    ctx.close()
    # A new page restores only explicitly stored lists, not the comparison.
    ctx,p,errors=load(query='?section=lists',storage=saved_state)
    ok('personal lists restored from stored state',p.locator('.tk2-my-nav [data-list]').count()==4)
    ok('comparison reset in new page session',p.locator('#tk2-compare-count').inner_text()=='0')
    p.on('dialog',lambda d:d.accept())
    p.locator('#tk2-clear-lists').click()
    ok('clear lists removes only the new key',p.evaluate('!__prefs["euhem-toolkit-lists-v1"] && __prefs["other-progress"]==="keep"'))
    ok('empty lists view helpful',p.locator('.tk2-list-empty').is_visible())
    ctx.close()
    ctx,p,errors=load(query='?section=lists',blocked=True)
    p.locator('#tk2-list-name').fill('Session only');p.locator('#tk2-create-form button').click()
    ok('blocked storage leaves lists usable in memory',p.locator('.tk2-my-nav [data-list]').count()==1)
    ok('blocked storage warning is visible',p.locator('#tk2-storage-warning').is_visible())
    ok('blocked storage raises no runtime error',errors==[]);ctx.close()
    ctx,p,errors=load(query='?section=collections&collection=health-data')
    ok('deep link opens the right collection',p.locator('#tk2-pack-title').inner_text()=='Explore health and economic data')
    p.evaluate('window.__go("toolkit.html?section=collections&collection=write-present")')
    ok('popstate opens another valid collection',p.locator('#tk2-pack-title').inner_text()=='Write and present with clarity')
    p.evaluate('window.__go("toolkit.html?section=evil&collection=unknown")')
    ok('invalid navigation values fall back',p.locator('#tk2-browse').is_visible());ctx.close()
    # Rendering checks with real CSS, local images/fonts and actual feature code.
    for width in [320,390,768,1365]:
        ctx,p,errors=load(query='?section=collections',width=width)
        ok('collection page has no horizontal overflow '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if width in [390,1365]:
            p.screenshot(path=str(OUT/'screenshots'/f'collections-{width}.png'),full_page=True)
            p.screenshot(path=str(OUT/'screenshots'/f'collections-{width}-viewport.png'))
        p.locator('[data-pack="statistics-revision"]').click();p.locator('[data-copy-pack="statistics-revision"]').click()
        ok('personal list page has no overflow '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if width in [390,1365]:p.screenshot(path=str(OUT/'screenshots'/f'lists-{width}.png'),full_page=True)
        p.locator('#tk2-sections [data-section="compare"]').click()
        for id in ['jamovi','jasp','rstudio']:
            p.locator('#tk2-compare-choice').select_option(id);p.locator('#tk2-add-compare').click()
        ok('comparison scroll confined '+str(width),p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
        if width==1365:
            p.screenshot(path=str(OUT/'screenshots'/'compare-desktop.png'),full_page=True)
            p.evaluate('document.documentElement.dataset.theme="dark"');p.screenshot(path=str(OUT/'screenshots'/'compare-dark.png'),full_page=True)
        ok('no runtime errors at '+str(width),errors==[]);ctx.close()
    browser.close()
(OUT/'browser-results.json').write_text(json.dumps({'harness':'Actual sources inline; adapted URL/history/storage/fetch; not live deployment or persistent storage test','passed':len(checks),'checks':checks},indent=2))
print('PASS',len(checks),'organiser browser checks')
