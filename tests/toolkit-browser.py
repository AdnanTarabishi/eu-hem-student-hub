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
    ok('English Toolkit title mounted',p.locator('.tk-hero h1').inner_text().strip()=='Student Toolkit.')
    ok('9 available entries shown initially',p.locator('#tk-results .tk-tool').count()==9)
    ok('3 planned entries shown initially',p.locator('#tk-plans .tk-tool').count()==3)
    ok('57 live entries counted honestly',p.locator('#tk-available-count').inner_text()=='57')
    ok('13 planned ideas counted separately',p.locator('#tk-planned-count').inner_text()=='13')
    ok('No history is stored by default',not p.locator('#tk-remember').is_checked())
    ok('Resources menu includes Toolkit',p.locator('#site-nav a[href="toolkit.html"]').count()==1)
    ok('Native footer includes Toolkit',p.locator('.site-footer a[href="toolkit.html"]').count()==1)
    def reset():
        if p.locator('#tk-dialog').is_visible():p.keyboard.press('Escape')
        p.evaluate('document.querySelector("#tk-search").value=""')
        p.locator('#tk-reset').evaluate('(el)=>el.click()')
    def q(text):p.locator('#tk-search').fill(text);p.wait_for_timeout(220)
    def reveal_filters():p.locator('.tk-refine').evaluate('(el)=>el.open=true')
    q('normal');ok('search normal retrieves matching live tools',p.locator('#tk-results .tk-tool').count()>=2)
    q('notebooklm');ok('old NotebookLM name remains searchable',p.locator('#tool-notebooklm').count()==1)
    q('gemini');ok('current provider name is searchable',p.locator('#tool-notebooklm').count()==1)
    q('zzzz-no-tool');ok('empty result state shown',p.locator('#tk-empty').is_visible() and not p.locator('#tk-available').is_visible())
    p.locator('#tk-empty-reset').click();ok('clear empty state restores catalog',p.locator('#tk-available-count').inner_text()=='57')
    p.locator('#tk-find-calculators').click();ok('lab shortcut filters exactly 12 tools',p.locator('#tk-available-count').inner_text()=='12')
    ok('all filtered lab entries builtin',p.locator('#tk-results .tk-tool:not([data-kind="builtin"])').count()==0)
    p.locator('#tk-more').click();ok('show more reveals all 12 calculators',p.locator('#tk-results .tk-tool').count()==12)
    p.locator('[data-detail="normal"]').click();ok('detail modal opens with correct title',p.locator('#tk-detail-title').inner_text()=='Normal Distribution')
    ok('lab details link to both correct courses',p.locator('.tk-detail-courses a').count()==2 and 'labtool=normal' in p.locator('.tk-detail-courses a').first.get_attribute('href'))
    p.locator('#tk-copy-link').click();ok('entry-link clipboard fallback',p.locator('#tk-link-fallback').is_visible() and 'tool=normal' in p.locator('#tk-link-text').input_value())
    p.keyboard.press('Escape');ok('Escape closes dialog and restores focus',not p.locator('#tk-dialog').is_visible() and p.locator('[data-detail="normal"]').evaluate('(el)=>el===document.activeElement'))
    reset();reveal_filters();p.locator('#tk-kind').select_option('planned')
    ok('planned filter has no available section',not p.locator('#tk-available').is_visible())
    ok('planned cards cannot launch an unbuilt tool',p.locator('#tk-plans [data-launch]').count()==0)
    p.locator('[data-detail="four-city-budget"]').click();ok('budget correctly marked planned',p.locator('#tk-detail-content .tk-badge').inner_text()=='Planned')
    ok('budget has correct programme cities',all(w in p.locator('#tk-detail-content').inner_text() for w in ['Bologna','Oslo','Innsbruck','Rotterdam']))
    ok('planned dialog has no launch',p.locator('#tk-detail-content [data-launch]').count()==0)
    p.locator('#tk-detail-content [data-save]').click();ok('planned ideas can be bookmarked honestly',p.locator('#tk-detail-content [data-save]').get_attribute('aria-pressed')=='true')
    p.keyboard.press('Escape');reset();p.locator('#tk-saved').click()
    ok('saved list contains bookmarked planned idea',p.locator('#tool-four-city-budget').count()==1)
    p.locator('#tool-four-city-budget [data-save]').click();ok('removing last saved item gives helpful empty state',p.locator('#tk-empty-title').inner_text()=='Your shortlist starts here.')
    reset();q('zotero');p.locator('#tool-zotero [data-save]').click()
    ok('bookmark persists as known ID only',p.evaluate('JSON.parse(window.__prefs["euhem-toolkit-v1"]).saved[0]')=='zotero')
    p.locator('#tool-zotero [data-launch]').click();ok('no recent tracking without opt-in',p.evaluate('JSON.parse(window.__prefs["euhem-toolkit-v1"]).recent.length')==0)
    p.locator('#tk-remember').check();p.locator('#tool-zotero [data-launch]').click()
    ok('opt-in records actual opened tool',p.evaluate('JSON.parse(window.__prefs["euhem-toolkit-v1"]).recent[0]')=='zotero')
    p.locator('#tk-remember').uncheck();ok('opting out clears recent list',p.evaluate('JSON.parse(window.__prefs["euhem-toolkit-v1"]).recent.length')==0)
    ok('external links have safe new-tab attributes',p.locator('#tool-zotero [data-launch]').get_attribute('rel')=='noopener noreferrer')
    p.locator('#tool-zotero [data-detail="zotero"]').click();ok('external details contain review date and provider source',p.locator('#tk-detail-content time').get_attribute('datetime')=='2026-10-07' and 'Provider information' in p.locator('#tk-detail-content').inner_text())
    p.keyboard.press('Escape');reset();reveal_filters();p.locator('#tk-kind').select_option('external');ok('36 external entries filter',p.locator('#tk-available-count').inner_text()=='36')
    p.locator('[data-category-filter="cities"]').click();ok('category and kind filter combine',p.locator('#tk-results .tk-tool').count()==6)
    p.locator('#tk-course').select_option('fundamentals');ok('course restriction AND external filter gives empty',p.locator('#tk-empty').is_visible())
    reset();p.locator('#tk-list').click();ok('list view switches actual layout',p.locator('#tk-results').evaluate('(el)=>el.classList.contains("tk-list-view")'))
    reveal_filters();p.locator('#tk-sort').select_option('az');ok('A-Z sorted first item',p.locator('#tk-results h4').first.inner_text()=='9292')
    reset();p.locator('#tk-grid').click();p.locator('#tk-more').click();ok('load more adds nine cards',p.locator('#tk-results .tk-tool').count()==18)
    # Deep-link restoration in the test's URL adapter.
    p.evaluate('window.__go("https://toolkit.example/toolkit.html?tool=descriptive")');ok('history updates open the requested entry',p.locator('#tk-detail-title').inner_text()=='Data Summary & Box Plot')
    p.evaluate('window.__go("https://toolkit.example/toolkit.html?kind=planned")');p.wait_for_timeout(80);ok('history can leave dialog for planned filter',not p.locator('#tk-dialog').is_visible() and not p.locator('#tk-available').is_visible())
    reset();q('<img src=x onerror=alert(1)>');ok('query is text not markup',p.locator('#tk-results img').count()==0 and p.locator('#tk-empty').is_visible())
    reset();q('fundamentals study');
    # Workspace detail must not manufacture an unsupported labtool id.
    p.evaluate('document.querySelector("#tk-search").value=""');reset()
    p.evaluate('window.__go("https://toolkit.example/toolkit.html?tool=fundamentals-workspace")')
    ok('workspace details have no invalid lab mode link',p.locator('.tk-detail-courses').count()==0)
    p.keyboard.press('Escape');reset();p.evaluate('window.__prefs["unrelated-course-progress"]="keep"')
    p.on('dialog',lambda d:d.accept())
    p.locator('.tk-maintenance').first.evaluate('(el)=>el.open=true')
    p.locator('#tk-clear-device').click();ok('clear device does not erase course data',p.evaluate('window.__prefs["unrelated-course-progress"]')=='keep')
    ok('clear device removes Toolkit key',p.evaluate('!("euhem-toolkit-v1" in window.__prefs)'))
    # Responsive page, grid/list and dialog; screenshots from the real implementation.
    reset();p.locator('#tk-grid').click()
    for width in [320,390,768,1365,1720]:
        p.set_viewport_size({'width':width,'height':1000})
        p.evaluate('window.scrollTo(0,0)');p.wait_for_timeout(150)
        overflow=p.evaluate('document.documentElement.scrollWidth>innerWidth+1')
        if overflow:print('OVERFLOW',p.evaluate('[...document.querySelectorAll("*")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,20).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right])'))
        ok(f'grid fits {width}px viewport',not overflow)
        p.locator('#tk-list').click();ok(f'list fits {width}px viewport',not p.evaluate('document.documentElement.scrollWidth>innerWidth+1'))
        p.locator('#tk-grid').click();p.locator('[data-detail]').first.click()
        ok(f'dialog fits {width}px viewport',p.locator('#tk-dialog').evaluate('(el)=>el.getBoundingClientRect().width<=innerWidth && el.scrollWidth<=el.clientWidth+1'))
        p.keyboard.press('Escape')
        p.evaluate('document.querySelector(".tk-refine").open=false;document.querySelectorAll(".tk-maintenance").forEach(el=>el.open=false);document.activeElement.blur();window.scrollTo(0,0)')
        if width in [390,1365]:
            p.screenshot(path=str(OUT/'screenshots'/f'toolkit-{width}.png'),full_page=True)
            p.screenshot(path=str(OUT/'screenshots'/f'toolkit-{width}-viewport.png'))
    p.set_viewport_size({'width':1365,'height':1000});p.evaluate('document.documentElement.dataset.theme="dark";window.scrollTo(0,0)')
    p.screenshot(path=str(OUT/'screenshots'/'toolkit-dark.png'),full_page=True)
    ok('dark theme resolves to dark surface',p.locator('#tool-descriptive').evaluate('(el)=>getComputedStyle(el).backgroundColor')!='rgb(255, 255, 255)')
    p.evaluate('document.documentElement.dataset.theme="light"')
    p.locator('#tool-descriptive [data-detail="descriptive"]').click();p.screenshot(path=str(OUT/'screenshots'/'toolkit-detail.png'))
    ok('no browser runtime errors in interaction suite',errors==[])
    saved=p.evaluate('({...window.__prefs,"euhem-toolkit-v1":JSON.stringify({saved:["zotero"],rememberRecent:true,recent:["zotero"]})})')
    ctx.close()
    ctx,p,errs=load(query='?tool=health-economics-calculator',storage=saved)
    ok('deep link opens a planned detail on first load',p.locator('#tk-detail-title').inner_text()=='Health Economics Calculator')
    p.keyboard.press('Escape');p.locator('#tk-saved').click();ok('previous saved state restores',p.locator('#tool-zotero').count()==1)
    ok('restored recent list reflects only provided local data',p.locator('#tk-recents').inner_text().count('Zotero')==1)
    ctx.close()
    ctx,p,errs=load(blocked=True)
    ok('blocked storage gives visible warning',p.locator('#tk-storage-warning').is_visible())
    p.locator('#tool-descriptive [data-save]').click();ok('bookmarks still work in memory when blocked',p.locator('#tk-saved-count').inner_text()=='1')
    ok('blocked storage has no runtime exception',errs==[]);ctx.close()
    ctx,p,errs=load(query='?kind=unknown&category=evil&tool=not-a-tool',storage={'euhem-toolkit-v1':'not json'})
    ok('corrupt saved data and invalid URL fall back safely',p.locator('#tk-available-count').inner_text()=='57' and not p.locator('#tk-dialog').is_visible())
    ctx.close()
    # Sitewide search must index the new catalogue. Load actual local deps with inline loader.
    ctx,p,errs=load()
    p.locator('.header-actions .search-button').click()
    p.wait_for_timeout(1500)
    p.locator('.search-input').fill('four city budget');p.wait_for_timeout(350)
    ok('site-wide search indexes planned idea with honest label',p.locator('.search-result[href="toolkit.html?tool=four-city-budget"]').count()==1 and 'Planned' in p.locator('.search-result[href="toolkit.html?tool=four-city-budget"]').inner_text())
    p.locator('.search-input').fill('Zotero');p.wait_for_timeout(220)
    ok('site-wide search indexes live external entry',p.locator('.search-result[href="toolkit.html?tool=zotero"]').count()==1)
    ok('site-wide search no runtime errors',errs==[]);ctx.close()
    # Fresh-page previews avoid sticky-header artifacts from the interaction scroll state.
    for width in [390,1365]:
        ctx,p,errs=load(width=width)
        p.wait_for_timeout(300)
        p.evaluate('window.scrollTo({top:0,behavior:"instant"})')
        p.wait_for_timeout(100)
        p.screenshot(path=str(OUT/'screenshots'/f'toolkit-{width}-viewport.png'))
        p.screenshot(path=str(OUT/'screenshots'/f'toolkit-{width}.png'),full_page=True)
        if width==1365:
            p.evaluate('document.documentElement.dataset.theme="dark";window.scrollTo({top:0,behavior:"instant"})')
            p.wait_for_timeout(100)
            p.screenshot(path=str(OUT/'screenshots'/'toolkit-dark.png'),full_page=True)
        ctx.close()
    browser.close()
(OUT/'browser-results.json').write_text(json.dumps({'harness':'Inline actual source; adapted URL/history/storage/fetch; not live site or offline service-worker test','passed':len(checks),'checks':checks},indent=2))
print(f'PASS {len(checks)} browser checks')
